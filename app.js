class CoefficientCalculator {
    constructor() {
        this.demandFiles = [];
        this.swatFiles = [];
        this.results = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateCalculateButton();
    }
    
    bindEvents() {
        // Demand файлы
        const demandUpload = document.getElementById('demandUpload');
        const demandInput = document.getElementById('demandFiles');
        
        demandUpload.addEventListener('click', () => demandInput.click());
        demandUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            demandUpload.classList.add('drag-over');
        });
        
        demandUpload.addEventListener('dragleave', () => {
            demandUpload.classList.remove('drag-over');
        });
        
        demandUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            demandUpload.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files, 'demand');
        });
        
        demandInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, 'demand');
            e.target.value = '';
        });
        
        // SWAT файлы
        const swatUpload = document.getElementById('swatUpload');
        const swatInput = document.getElementById('swatFiles');
        
        swatUpload.addEventListener('click', () => swatInput.click());
        swatUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            swatUpload.classList.add('drag-over');
        });
        
        swatUpload.addEventListener('dragleave', () => {
            swatUpload.classList.remove('drag-over');
        });
        
        swatUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            swatUpload.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files, 'swat');
        });
        
        swatInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files, 'swat');
            e.target.value = '';
        });
        
        // Кнопка расчета
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());
        
        // Кнопка скачивания
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadExcel());
    }
    
    handleFiles(files, type) {
        const validFiles = [];
        
        for (let file of files) {
            if (file.name.toLowerCase().endsWith('.csv')) {
                validFiles.push(file);
            } else {
                this.showAlert('warning', `Файл ${file.name} не является CSV файлом и будет пропущен`);
            }
        }
        
        if (type === 'demand') {
            this.demandFiles.push(...validFiles);
            this.renderFileList('demandFileList', this.demandFiles, 'demand');
        } else {
            this.swatFiles.push(...validFiles);
            this.renderFileList('swatFileList', this.swatFiles, 'swat');
        }
        
        this.updateCalculateButton();
        this.showAlert('success', `Добавлено ${validFiles.length} файлов ${type}`);
    }
    
    renderFileList(containerId, files, type) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (files.length === 0) {
            container.innerHTML = '<div class="text-muted text-center">Нет загруженных файлов</div>';
            return;
        }
        
        files.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div>
                    <i class="bi bi-file-text file-icon"></i>
                    <span>${file.name} (${this.formatFileSize(file.size)})</span>
                </div>
                <button class="file-remove" data-index="${index}" data-type="${type}">
                    <i class="bi bi-x-lg"></i>
                </button>
            `;
            container.appendChild(div);
        });
        
        // Добавляем обработчики удаления
        container.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                const type = e.currentTarget.dataset.type;
                this.removeFile(index, type);
            });
        });
    }
    
    removeFile(index, type) {
        if (type === 'demand') {
            this.demandFiles.splice(index, 1);
            this.renderFileList('demandFileList', this.demandFiles, 'demand');
        } else {
            this.swatFiles.splice(index, 1);
            this.renderFileList('swatFileList', this.swatFiles, 'swat');
        }
        
        this.updateCalculateButton();
    }
    
    updateCalculateButton() {
        const btn = document.getElementById('calculateBtn');
        btn.disabled = this.demandFiles.length === 0 || this.swatFiles.length === 0;
    }
    
    async calculate() {
        if (this.demandFiles.length === 0 || this.swatFiles.length === 0) {
            this.showAlert('danger', 'Загрузите файлы DEMAND и SWAT');
            return;
        }
        
        this.showLoading(true);
        
        try {
            this.results = await this.processFiles();
            this.displayResults();
            this.showAlert('success', 'Расчет успешно завершен!');
        } catch (error) {
            console.error('Calculation error:', error);
            this.showAlert('danger', `Ошибка расчета: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    async processFiles() {
        const progressContainer = document.getElementById('progressContainer');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressContainer.style.display = 'block';
        
        // Шаг 1: Загрузка и обработка DEMAND файлов
        progressFill.style.width = '25%';
        progressText.textContent = '25%';
        const demandData = await this.processDemandFiles();
        
        // Шаг 2: Загрузка и обработка SWAT файлов
        progressFill.style.width = '50%';
        progressText.textContent = '50%';
        const swatData = await this.processSwatFiles();
        
        // Шаг 3: Расчет метрик
        progressFill.style.width = '75%';
        progressText.textContent = '75%';
        const demandMetrics = this.calculateMetrics(demandData);
        
        // Шаг 4: Расчет коэффициентов
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        const results = this.calculateCoefficients(swatData, demandMetrics);
        
        progressContainer.style.display = 'none';
        
        return results;
    }
    
    async processDemandFiles() {
        let allDemand = [];
        let allPrediction = [];
        let allOSA = [];
        let allWriteoffs = [];
        
        for (const file of this.demandFiles) {
            const content = await this.readFile(file);
            const rows = this.parseCSV(content);
            
            console.log(`Обработка DEMAND файла: ${file.name}, строк: ${rows.length}`);
            
            for (const row of rows) {
                const measure = row['Measure Names'];
                if (!measure) continue;
                
                const value = this.parseNumber(row[''] || row.value || row.Value || 0);
                
                const productId = this.createProductId(
                    row['level 1'],
                    row['level 4']
                );
                
                const item = {
                    product_id: productId,
                    level1: row['level 1'],
                    level2: row['level 2'],
                    level3: row['level 3'],
                    level4: row['level 4'],
                    value: value
                };
                
                if (measure === 'demand') {
                    allDemand.push(item);
                } else if (measure === 'prediction_final') {
                    allPrediction.push(item);
                } else if (measure === 'OSA') {
                    allOSA.push(item);
                } else if (measure === 'writeoffs_perc') {
                    allWriteoffs.push(item);
                }
            }
        }
        
        console.log(`Demand записи: ${allDemand.length}, Prediction записи: ${allPrediction.length}`);
        
        // Агрегируем данные
        return {
            demand: this.aggregateToArray(allDemand, 'sum'),
            prediction: this.aggregateToArray(allPrediction, 'sum'),
            osa: this.aggregateToArray(allOSA, 'avg'),
            writeoffs: this.aggregateToArray(allWriteoffs, 'avg')
        };
    }
    
    async processSwatFiles() {
        let allSwat = [];
        
        for (const file of this.swatFiles) {
            const content = await this.readFile(file);
            const rows = this.parseCSV(content);
            
            console.log(`Обработка SWAT файла: ${file.name}, строк: ${rows.length}`);
            
            for (const row of rows) {
                const measure = row['Measure Names'];
                if (measure !== 'prediction_swat') continue;
                
                const value = this.parseNumber(row[''] || row.value || row.Value || 0);
                
                const productId = this.createProductId(
                    row['level 1'],
                    row['level 4']
                );
                
                allSwat.push({
                    product_id: productId,
                    level1: row['level 1'],
                    level2: row['level 2'],
                    level3: row['level 3'],
                    level4: row['level 4'],
                    value: value
                });
            }
        }
        
        console.log(`SWAT записи: ${allSwat.length}`);
        
        // Возвращаем массив агрегированных данных
        return this.aggregateToArray(allSwat, 'sum');
    }
    
    // Функция для агрегации в массив
    aggregateToArray(data, method = 'sum') {
        const aggregated = {};
        
        data.forEach(item => {
            if (!item.product_id) return;
            
            if (!aggregated[item.product_id]) {
                aggregated[item.product_id] = {
                    product_id: item.product_id,
                    value: 0,
                    level1: item.level1,
                    level2: item.level2,
                    level3: item.level3,
                    level4: item.level4,
                    count: 0
                };
            }
            
            if (method === 'avg') {
                aggregated[item.product_id].value += item.value;
                aggregated[item.product_id].count += 1;
            } else {
                aggregated[item.product_id].value += item.value;
            }
        });
        
        // Для среднего значения делим на количество
        if (method === 'avg') {
            Object.keys(aggregated).forEach(key => {
                if (aggregated[key].count > 0) {
                    aggregated[key].value /= aggregated[key].count;
                }
            });
        }
        
        // Преобразуем объект в массив
        return Object.values(aggregated);
    }
    
    calculateMetrics(demandData) {
        const results = [];
        
        // Создаем Map для быстрого поиска
        const demandMap = new Map();
        const predictionMap = new Map();
        const osaMap = new Map();
        const writeoffsMap = new Map();
        
        // Заполняем Map'ы
        if (Array.isArray(demandData.demand)) {
            demandData.demand.forEach(item => {
                if (item && item.product_id) {
                    demandMap.set(item.product_id, item);
                }
            });
        }
        
        if (Array.isArray(demandData.prediction)) {
            demandData.prediction.forEach(item => {
                if (item && item.product_id) {
                    predictionMap.set(item.product_id, item);
                }
            });
        }
        
        if (Array.isArray(demandData.osa)) {
            demandData.osa.forEach(item => {
                if (item && item.product_id) {
                    osaMap.set(item.product_id, item);
                }
            });
        }
        
        if (Array.isArray(demandData.writeoffs)) {
            demandData.writeoffs.forEach(item => {
                if (item && item.product_id) {
                    writeoffsMap.set(item.product_id, item);
                }
            });
        }
        
        console.log(`Уникальных товаров в demand: ${demandMap.size}`);
        
        // Обрабатываем все demand записи
        for (const [productId, demandItem] of demandMap) {
            if (!demandItem) continue;
            
            const demand = demandItem;
            const prediction = predictionMap.get(productId) || { value: 0 };
            const osa = osaMap.get(productId) || { value: 0 };
            const writeoffs = writeoffsMap.get(productId) || { value: 0 };
            
            // Значения
            const demandValue = demand.value || 0;
            const predictionValue = prediction.value || 0;
            
            // Округление
            const demandRounded = Math.round(demandValue);
            const predictionRounded = Math.round(predictionValue);
            
            // Difference
            const difference = predictionRounded - demandRounded;
            
            // Bias %
            const bias = demandRounded !== 0 ? (difference / demandRounded * 100) : 0;
            
            results.push({
                product_id: productId,
                level1: demand.level1,
                level2: demand.level2,
                level3: demand.level3,
                level4: demand.level4,
                demand_sum: demandRounded,
                prediction_final_sum: predictionRounded,
                difference: difference,
                bias_percent: Math.round(bias * 100) / 100,
                osa_percent: Math.round(osa.value * 100 * 100) / 100,
                writeoffs_percent: Math.round(writeoffs.value * 100 * 100) / 100
            });
        }
        
        console.log(`Рассчитано метрик: ${results.length}`);
        
        return results;
    }
    
    calculateCoefficients(swatData, demandMetrics) {
        const results = [];
        
        // Преобразуем swatData в Map
        const swatMap = new Map();
        
        if (Array.isArray(swatData)) {
            swatData.forEach(item => {
                if (item && item.product_id) {
                    swatMap.set(item.product_id, item.value || 0);
                }
            });
        }
        
        console.log(`Уникальных товаров в SWAT: ${swatMap.size}`);
        
        for (const metric of demandMetrics) {
            const swatValue = swatMap.get(metric.product_id) || 0;
            const demandValue = metric.demand_sum || 0;
            
            // Исходный коэффициент
            let exactCoefficient = 0;
            if (swatValue !== 0 && demandValue !== 0) {
                exactCoefficient = demandValue / swatValue;
            }
            
            // Округление до 2 знаков
            const rawCoefficient = Math.round(exactCoefficient * 100) / 100;
            
            // Применение правил корректировки
            let adjustedCoefficient = rawCoefficient;
            
            // Проверяем NaN и бесконечность
            if (isNaN(rawCoefficient) || !isFinite(rawCoefficient)) {
                adjustedCoefficient = 0.8;
            } else if (rawCoefficient >= 0.96 && rawCoefficient <= 1.04) {
                adjustedCoefficient = 1.00;
            } else if (rawCoefficient < 0.8) {
                adjustedCoefficient = 0.80;
            } else if (rawCoefficient > 1.5) {
                adjustedCoefficient = 1.50;
            }
            
            results.push({
                ...metric,
                swat_sum: Math.round(swatValue),
                coefficient_raw: rawCoefficient,
                coefficient_adjusted: adjustedCoefficient
            });
        }
        
        console.log(`Рассчитано коэффициентов: ${results.length}`);
        
        return results;
    }
    
    displayResults() {
        const container = document.getElementById('resultContainer');
        const table = document.getElementById('resultTable');
        const statsGrid = document.getElementById('statsGrid');
        
        // Обновляем статистику
        this.updateStats(statsGrid);
        
        // Заполняем таблицу
        table.innerHTML = '';
        const displayCount = Math.min(this.results.length, 50);
        
        if (this.results.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="9" class="text-center">Нет данных для отображения</td>`;
            table.appendChild(row);
            return;
        }
        
        this.results.slice(0, displayCount).forEach(item => {
            const row = document.createElement('tr');
            
            // Определяем классы для стилизации
            const coefClass = this.getCoefficientClass(item.coefficient_adjusted);
            const diffClass = item.difference > 0 ? 'positive' : (item.difference < 0 ? 'negative' : 'neutral');
            
            row.innerHTML = `
                <td>${item.product_id || ''}</td>
                <td>${item.level3 || ''}</td>
                <td class="${coefClass}">${item.coefficient_raw.toFixed(2)}</td>
                <td class="${coefClass}">${item.coefficient_adjusted.toFixed(2)}</td>
                <td>${item.demand_sum.toLocaleString()}</td>
                <td>${item.swat_sum.toLocaleString()}</td>
                <td>${item.prediction_final_sum.toLocaleString()}</td>
                <td class="${diffClass}">${item.difference.toLocaleString()}</td>
                <td class="${diffClass}">${item.bias_percent.toFixed(2)}%</td>
            `;
            table.appendChild(row);
        });
        
        // Показываем количество неотображенных строк
        if (this.results.length > 50) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `<td colspan="9" class="text-center text-muted">
                ... и ещё ${this.results.length - 50} строк. Скачайте Excel файл для просмотра всех данных.
            </td>`;
            table.appendChild(infoRow);
        }
        
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }
    
    updateStats(container) {
        if (!this.results || this.results.length === 0) return;
        
        const total = this.results.length;
        const coef1 = this.results.filter(r => r.coefficient_adjusted === 1.00).length;
        const coef08 = this.results.filter(r => r.coefficient_adjusted === 0.80).length;
        const coef15 = this.results.filter(r => r.coefficient_adjusted === 1.50).length;
        const coefOther = total - coef1 - coef08 - coef15;
        
        const totalDemand = this.results.reduce((sum, r) => sum + r.demand_sum, 0);
        const totalSwat = this.results.reduce((sum, r) => sum + r.swat_sum, 0);
        const totalPrediction = this.results.reduce((sum, r) => sum + r.prediction_final_sum, 0);
        const totalDifference = this.results.reduce((sum, r) => sum + r.difference, 0);
        const avgBias = total > 0 ? this.results.reduce((sum, r) => sum + r.bias_percent, 0) / total : 0;
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Всего товаров</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${coef1}</div>
                <div class="stat-label">Коэф = 1.00</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${coef08}</div>
                <div class="stat-label">Коэф = 0.80</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${coef15}</div>
                <div class="stat-label">Коэф = 1.50</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalDemand.toLocaleString()}</div>
                <div class="stat-label">Сумма Demand</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalSwat.toLocaleString()}</div>
                <div class="stat-label">Сумма SWAT</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${avgBias.toFixed(2)}%</div>
                <div class="stat-label">Средний Bias</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalDifference > 0 ? '+' : ''}${totalDifference.toLocaleString()}</div>
                <div class="stat-label">Общая разница</div>
            </div>
        `;
    }
    
    async downloadExcel() {
    if (!this.results || this.results.length === 0) {
        this.showAlert('warning', 'Нет данных для экспорта');
        return;
    }
    
    this.showLoading(true);
    
    try {
        // Основной лист с коэффициентами
        const mainData = this.results.map(item => ({
            'Product ID': item.product_id,
            'Level 1': item.level1,
            'Level 2': item.level2,
            'Level 3': item.level3,
            'Level 4': item.level4,
            'Коэффициент (raw)': item.coefficient_raw,
            'Коэффициент (adjusted)': item.coefficient_adjusted,
            'Demand': item.demand_sum,
            'SWAT': item.swat_sum,
            'Prediction Final': item.prediction_final_sum,
            'Difference': item.difference,
            // Excel ожидает проценты в формате 0.xx для xx%
            'Bias %': (item.bias_percent || 0) / 100,
            'OSA %': (item.osa_percent || 0) / 100,
            'Writeoffs %': (item.writeoffs_percent || 0) / 100
        }));
        
        // Лист со статистикой
        const total = this.results.length;
        const coef1 = this.results.filter(r => r.coefficient_adjusted === 1.00).length;
        const coef08 = this.results.filter(r => r.coefficient_adjusted === 0.80).length;
        const coef15 = this.results.filter(r => r.coefficient_adjusted === 1.50).length;
        
        const statsData = [
            ['Статистика коэффициентов', 'Количество', 'Процент'],
            ['Коэффициент = 1.00', coef1, `${(coef1/total*100).toFixed(1)}%`],
            ['Коэффициент = 0.80', coef08, `${(coef08/total*100).toFixed(1)}%`],
            ['Коэффициент = 1.50', coef15, `${(coef15/total*100).toFixed(1)}%`],
            ['Другие коэффициенты', total - coef1 - coef08 - coef15, `${((total - coef1 - coef08 - coef15)/total*100).toFixed(1)}%`],
            ['Всего товаров', total, '100%']
        ];
        
        // Создаем рабочую книгу
        const wb = XLSX.utils.book_new();
        
        // Основной лист
        const ws1 = XLSX.utils.json_to_sheet(mainData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Коэффициенты и метрики');
        
        // Лист со статистикой
        const ws2 = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Статистика');
        
        // Лист с информацией
        const infoData = [
            ['Параметр', 'Значение'],
            ['Дата создания отчета', new Date().toLocaleString('ru-RU')],
            ['Количество товаров', total],
            ['Рассчитанные метрики', 'Coefficient, Difference, Bias %, OSA %, Writeoffs %'],
            ['Формула Bias %', '(prediction_final - demand) / demand * 100'],
            ['Формула Difference', 'prediction_final - demand'],
            ['Формула коэффициента', 'demand / swat'],
            ['Примечание', 'Колонки Bias %, OSA %, Writeoffs % в процентах (например, 0.1786 = 17.86%)'],
            ['Количество файлов DEMAND', this.demandFiles.length],
            ['Количество файлов SWAT', this.swatFiles.length]
        ];
        const ws3 = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Информация');
        
        // Сохраняем файл
        const filename = `coefficients_report_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        this.showAlert('success', `Файл "${filename}" успешно скачан! Откройте его и отформатируйте колонки Bias %, OSA %, Writeoffs % как "Процентный формат".`);
    } catch (error) {
        console.error('Excel export error:', error);
        this.showAlert('danger', 'Ошибка при создании Excel файла: ' + error.message);
    } finally {
        this.showLoading(false);
    }
}
    
    // Вспомогательные методы
    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    parseCSV(content) {
        try {
            const lines = content.split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) return [];
            
            // Разделитель - точка с запятой
            const delimiter = ';';
            
            // Извлекаем заголовки
            const headers = lines[0].split(delimiter).map(h => 
                h.trim().replace(/"/g, '').replace(/\s+/g, ' ')
            );
            
            const result = [];
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const values = [];
                let currentValue = '';
                let inQuotes = false;
                
                for (let j = 0; j < line.length; j++) {
                    const char = line[j];
                    
                    if (char === '"') {
                        inQuotes = !inQuotes;
                    } else if (char === delimiter && !inQuotes) {
                        values.push(currentValue.trim().replace(/"/g, ''));
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                
                // Добавляем последнее значение
                values.push(currentValue.trim().replace(/"/g, ''));
                
                // Создаем объект
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] !== undefined ? values[index] : '';
                });
                
                result.push(obj);
            }
            
            console.log(`Парсинг CSV: заголовки: ${headers}, строк: ${result.length}`);
            
            return result;
        } catch (error) {
            console.error('CSV parsing error:', error);
            return [];
        }
    }
    
    parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        
        let str = String(value).trim();
        
        // Если пустая строка
        if (str === '""' || str === '' || str === 'null') {
            return 0;
        }
        
        // Убираем кавычки если есть
        str = str.replace(/"/g, '');
        
        // Убираем пробелы (разделители тысяч)
        str = str.replace(/\s/g, '');
        
        // Заменяем запятую на точку для десятичных чисел
        str = str.replace(/,/g, '.');
        
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }
    
    createProductId(level1, level4) {
        if (!level1 || !level4) return '';
        
        const l1 = String(level1).trim().replace(/\s+/g, '');
        const l4 = String(level4).trim().replace(/\.0$/, '').replace(/"/g, '');
        
        return l1 + l4;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    getCoefficientClass(coef) {
        if (coef === 1.00) return 'coef-1';
        if (coef === 0.80) return 'coef-08';
        if (coef === 1.50) return 'coef-15';
        return '';
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        const calculateBtn = document.getElementById('calculateBtn');
        
        if (show) {
            loading.style.display = 'block';
            calculateBtn.disabled = true;
        } else {
            loading.style.display = 'none';
            this.updateCalculateButton();
        }
    }
    
    showAlert(type, message) {
        const container = document.getElementById('alertContainer');
        
        // Очищаем старые алерты
        container.innerHTML = '';
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-message alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        container.appendChild(alert);
        
        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new CoefficientCalculator();
});


