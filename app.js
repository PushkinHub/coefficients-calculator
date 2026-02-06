class CoefficientCalculator {
    constructor() {
        this.demandFiles = [];
        this.swatFiles = [];
        this.results = null;
        
        // Константы безопасности
        this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        this.MAX_TOTAL_FILES = 20;
        this.MAX_ROWS_PER_FILE = 50000;
        this.MAX_TOTAL_ROWS = 500000;

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

        demandUpload.addEventListener('drop', async (e) => {
            e.preventDefault();
            demandUpload.classList.remove('drag-over');
            await this.handleFiles(e.dataTransfer.files, 'demand');
        });

        demandInput.addEventListener('change', async (e) => {
            await this.handleFiles(e.target.files, 'demand');
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

        swatUpload.addEventListener('drop', async (e) => {
            e.preventDefault();
            swatUpload.classList.remove('drag-over');
            await this.handleFiles(e.dataTransfer.files, 'swat');
        });

        swatInput.addEventListener('change', async (e) => {
            await this.handleFiles(e.target.files, 'swat');
            e.target.value = '';
        });

        // Кнопка расчета
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculate());

        // Кнопка скачивания
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadExcel());
    }

    async handleFiles(files, type) {
        const validFiles = [];
        const errors = [];

        // Проверка общего количества файлов
        const currentCount = type === 'demand' ? this.demandFiles.length : this.swatFiles.length;
        if (currentCount + files.length > this.MAX_TOTAL_FILES) {
            this.showAlert('warning', `Максимальное количество файлов: ${this.MAX_TOTAL_FILES}`);
            return;
        }

        for (let file of files) {
            try {
                // 1. Проверка расширения
                if (!this.isValidCSVExtension(file.name)) {
                    errors.push(`"${this.sanitizeFileName(file.name)}" - не CSV файл`);
                    continue;
                }

                // 2. Проверка размера
                if (file.size > this.MAX_FILE_SIZE) {
                    errors.push(`"${this.sanitizeFileName(file.name)}" - слишком большой (${this.formatFileSize(file.size)})`);
                    continue;
                }

                // 3. Проверка содержимого файла
                const isValid = await this.validateCSVContent(file);
                if (!isValid) {
                    errors.push(`"${this.sanitizeFileName(file.name)}" - неверный формат CSV`);
                    continue;
                }

                validFiles.push(file);
                
            } catch (error) {
                errors.push(`"${this.sanitizeFileName(file.name)}" - ошибка проверки: ${error.message}`);
            }
        }

        // Показать ошибки
        if (errors.length > 0) {
            const errorMsg = errors.slice(0, 3).join('<br>');
            const moreMsg = errors.length > 3 ? `<br>...и еще ${errors.length - 3} ошибок` : '';
            this.showAlert('warning', `Ошибки загрузки:<br>${errorMsg}${moreMsg}`);
        }

        if (validFiles.length > 0) {
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
    }

    isValidCSVExtension(filename) {
        const name = filename.toLowerCase().trim();
        return name.endsWith('.csv');
    }

    async validateCSVContent(file) {
        try {
            // Читаем только первые 5KB для проверки
            const preview = await this.readFilePreview(file, 5 * 1024);
            
            // Проверяем что это текст, а не бинарный файл
            if (!this.isTextContent(preview)) {
                return false;
            }

            // Проверяем наличие разделителей
            const hasDelimiters = preview.includes(';') || preview.includes(',');
            if (!hasDelimiters) {
                return false;
            }

            // Проверяем что нет опасного содержимого
            if (this.containsDangerousContent(preview)) {
                return false;
            }

            return true;
        } catch (error) {
            console.error('CSV validation error:', error);
            return false;
        }
    }

    isTextContent(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return true; // Пустая строка - ок
    }
    
    // Проверяем, что это в основном текст (не бинарные данные)
    // Русские символы, английские, цифры, знаки препинания - все ок
    const safeChars = /[\p{L}\p{N}\p{P}\p{Z}\p{S}\r\n\t;,"'=+\-@]/gu;
    
    // Считаем безопасные символы
    const safeMatches = text.match(safeChars);
    const safeCount = safeMatches ? safeMatches.length : 0;
    
    // Допускаем до 5% "небезопасных" символов (например, бинарные данные)
    return safeCount >= text.length * 0.95;
    }

    containsDangerousContent(text) {
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /onload=/i,
            /onerror=/i,
            /onclick=/i,
            /eval\(/i,
            /document\./i,
            /window\./i,
            /alert\(/i,
            /fromCharCode/i,
            /<!--/,
            /-->/,
            /<\/?[a-z][\s\S]*>/i  // HTML теги
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(text)) {
                console.warn('Обнаружено опасное содержимое:', pattern);
                return true;
            }
        }
        return false;
    }

    async readFilePreview(file, maxSize = 5 * 1024) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const blob = file.slice(0, Math.min(maxSize, file.size));
            
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Ошибка чтения файла'));
            reader.onabort = () => reject(new Error('Чтение файла прервано'));
            
            reader.readAsText(blob, 'UTF-8');
        });
    }

    renderFileList(containerId, files, type) {
        const container = document.getElementById(containerId);
        
        // Безопасная очистка контейнера
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        if (files.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'text-muted text-center';
            emptyDiv.textContent = 'Нет загруженных файлов';
            container.appendChild(emptyDiv);
            return;
        }

        files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0.8rem 1rem;
                background: white;
                border-radius: 8px;
                margin-bottom: 0.5rem;
                border: 1px solid #dee2e6;
            `;

            const leftSection = document.createElement('div');
            leftSection.style.cssText = 'display: flex; align-items: center; gap: 10px;';

            const icon = document.createElement('i');
            icon.className = 'bi bi-file-text file-icon';
            icon.style.color = '#3498db';

            const textSpan = document.createElement('span');
            textSpan.textContent = `${this.sanitizeFileName(file.name)} (${this.formatFileSize(file.size)})`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-remove';
            removeBtn.style.cssText = `
                background: none;
                border: none;
                color: #e74c3c;
                cursor: pointer;
                padding: 0 5px;
                font-size: 1.2rem;
            `;
            removeBtn.setAttribute('data-index', index);
            removeBtn.setAttribute('data-type', type);

            const removeIcon = document.createElement('i');
            removeIcon.className = 'bi bi-x-lg';

            removeBtn.appendChild(removeIcon);
            removeBtn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                const type = e.currentTarget.getAttribute('data-type');
                this.removeFile(index, type);
            });

            leftSection.appendChild(icon);
            leftSection.appendChild(textSpan);
            fileItem.appendChild(leftSection);
            fileItem.appendChild(removeBtn);
            container.appendChild(fileItem);
        });
    }

    sanitizeFileName(filename) {
        // Удаляем опасные символы, оставляем только безопасные
        return String(filename)
            .replace(/[<>:"/\\|?*]/g, '') // Удаляем опасные файловые символы
            .substring(0, 100); // Ограничение длины
    }

    sanitizeText(text) {
        // Безопасное отображение текста
        return String(text)
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/&/g, '&amp;')
            .substring(0, 200); // Ограничение длины
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
            // Ограничение общего количества строк
            const totalRows = await this.estimateTotalRows();
            if (totalRows > this.MAX_TOTAL_ROWS) {
                throw new Error(`Слишком много данных. Максимум: ${this.MAX_TOTAL_ROWS.toLocaleString()} строк`);
            }

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

    async estimateTotalRows() {
        let total = 0;
        
        // Оцениваем общее количество строк во всех файлах
        for (const files of [this.demandFiles, this.swatFiles]) {
            for (const file of files) {
                const content = await this.readFilePreview(file, 100 * 1024);
                const lines = content.split('\n').length - 1; // минус заголовок
                total += Math.min(lines, this.MAX_ROWS_PER_FILE);
            }
        }
        
        return total;
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
        let allData = [];
        let totalRows = 0;

        for (const file of this.demandFiles) {
            const content = await this.readFile(file);
            
            // Ограничение количества строк и безопасный парсинг
            const rows = this.parseCSVSafely(content, this.MAX_ROWS_PER_FILE);
            totalRows += rows.length;
            
            if (totalRows > this.MAX_TOTAL_ROWS) {
                throw new Error(`Превышен лимит строк в DEMAND файлах`);
            }

            console.log(`Обработка DEMAND файла: ${file.name}, строк: ${rows.length}`);

            // Колонка с числом — всегда последняя в CSV
            const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
            const valueCol = headers[headers.length - 1] || '';

            for (const row of rows) {
                const measureRaw = row['Measure Names'];
                if (!measureRaw) continue;

                const measure = this.sanitizeText(String(measureRaw).trim().toLowerCase());
                const rawVal = row[valueCol];
                const value = this.parseNumber(rawVal !== undefined && rawVal !== '' ? rawVal : 0);

                const productId = this.createProductId(
                    row['level 1'] || row['level1'],
                    row['level 4'] || row['level4']
                );

                if (!productId) continue;

                allData.push({
                    product_id: productId,
                    level1: this.sanitizeText(row['level 1'] || row['level1'] || ''),
                    level2: this.sanitizeText(row['level 2'] || row['level2'] || ''),
                    level3: this.sanitizeText(row['level 3'] || row['level3'] || ''),
                    level4: this.sanitizeText(row['level 4'] || row['level4'] || ''),
                    measure: measure,
                    value: value
                });
            }
        }

        console.log(`Всего записей в DEMAND: ${allData.length}`);

        // Группируем по product_id и measure
        const grouped = {};

        allData.forEach(item => {
            const key = `${item.product_id}_${item.measure}`;
            if (!grouped[key]) {
                grouped[key] = {
                    product_id: item.product_id,
                    level1: item.level1,
                    level2: item.level2,
                    level3: item.level3,
                    level4: item.level4,
                    measure: item.measure,
                    values: []
                };
            }
            grouped[key].values.push(item.value);
        });

        // Суммируем значения для каждой группы
        const aggregated = {};
        Object.values(grouped).forEach(group => {
            if (!aggregated[group.product_id]) {
                aggregated[group.product_id] = {
                    product_id: group.product_id,
                    level1: group.level1,
                    level2: group.level2,
                    level3: group.level3,
                    level4: group.level4,
                    demand: 0,
                    sales: 0,
                    prediction_final: 0,
                    osa: 0,
                    writeoffs: 0,
                    bias: 0,
                    accuracy: 0
                };
            }

            const sum = group.values.reduce((a, b) => a + b, 0);
            const measureNorm = (group.measure || '').toString().trim().toLowerCase();

            switch (measureNorm) {
                case 'demand':
                    aggregated[group.product_id].demand = sum;
                    break;
                case 'sales':
                    aggregated[group.product_id].sales = sum;
                    break;
                case 'prediction_final':
                    aggregated[group.product_id].prediction_final = sum;
                    break;
                case 'osa':
                    aggregated[group.product_id].osa = sum / Math.max(group.values.length, 1);
                    break;
                case 'writeoffs_perc':
                    aggregated[group.product_id].writeoffs = sum / Math.max(group.values.length, 1);
                    break;
                case 'bias':
                    aggregated[group.product_id].bias = sum / Math.max(group.values.length, 1);
                    break;
                case 'accuracy (final)':
                    aggregated[group.product_id].accuracy = sum / Math.max(group.values.length, 1);
                    break;
            }
        });

        return Object.values(aggregated);
    }

    parseCSVSafely(content, maxRows) {
        try {
            const rows = this.parseCSV(content);
            
            // Ограничение количества строк
            const limitedRows = rows.slice(0, maxRows);
            
            // Санитизация значений в каждой строке
            return limitedRows.map(row => {
                const sanitizedRow = {};
                for (const [key, value] of Object.entries(row)) {
                    // Защита от CSV инъекций
                    let safeValue = String(value);
                    const firstChar = safeValue.trim().charAt(0);
                    
                    if (['=', '+', '-', '@', '|', '\t', '\r'].includes(firstChar)) {
                        safeValue = "'" + safeValue; // Экранирование
                    }
                    
                    // Базовая санитизация
                    safeValue = safeValue
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .substring(0, 1000); // Ограничение длины
                    
                    sanitizedRow[key] = safeValue;
                }
                return sanitizedRow;
            });
        } catch (error) {
            console.error('CSV parsing error:', error);
            throw new Error('Ошибка парсинга CSV файла');
        }
    }

    async processSwatFiles() {
        let allSwat = [];
        let totalRows = 0;

        for (const file of this.swatFiles) {
            const content = await this.readFile(file);
            const rows = this.parseCSVSafely(content, this.MAX_ROWS_PER_FILE);
            totalRows += rows.length;
            
            if (totalRows > this.MAX_TOTAL_ROWS) {
                throw new Error(`Превышен лимит строк в SWAT файлах`);
            }

            console.log(`Обработка SWAT файла: ${file.name}, строк: ${rows.length}`);

            const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
            const valueCol = headers[headers.length - 1] || '';

            for (const row of rows) {
                const measure = row['Measure Names'];
                if (measure !== 'prediction_swat') continue;

                const rawVal = row[valueCol];
                const value = this.parseNumber(rawVal !== undefined && rawVal !== '' ? rawVal : 0);

                const productId = this.createProductId(
                    row['level 1'] || row['level1'],
                    row['level 4'] || row['level4']
                );

                if (!productId) continue;

                allSwat.push({
                    product_id: productId,
                    level1: this.sanitizeText(row['level 1'] || row['level1'] || ''),
                    level2: this.sanitizeText(row['level 2'] || row['level2'] || ''),
                    level3: this.sanitizeText(row['level 3'] || row['level3'] || ''),
                    level4: this.sanitizeText(row['level 4'] || row['level4'] || ''),
                    value: value
                });
            }
        }

        console.log(`SWAT записи: ${allSwat.length}`);

        // Группируем и суммируем SWAT
        const swatGrouped = {};

        allSwat.forEach(item => {
            const key = item.product_id;
            if (!swatGrouped[key]) {
                swatGrouped[key] = {
                    product_id: item.product_id,
                    level1: item.level1,
                    level2: item.level2,
                    level3: item.level3,
                    level4: item.level4,
                    values: []
                };
            }
            swatGrouped[key].values.push(item.value);
        });

        // Суммируем значения SWAT
        const swatAggregated = {};
        Object.values(swatGrouped).forEach(group => {
            swatAggregated[group.product_id] = {
                product_id: group.product_id,
                level1: group.level1,
                level2: group.level2,
                level3: group.level3,
                level4: group.level4,
                swat_sum: group.values.reduce((a, b) => a + b, 0)
            };
        });

        return swatAggregated;
    }

    calculateMetrics(demandData) {
        const results = [];

        demandData.forEach(item => {
            const demandRounded = Math.round(item.demand);
            const salesRounded = Math.round(item.sales);
            const predictionRounded = Math.round(item.prediction_final);

            // Difference
            const difference = predictionRounded - demandRounded;

            // Bias %
            const bias = demandRounded !== 0 ? (difference / demandRounded) : 0;
            const biasPercent = Math.round(bias * 100000) / 1000;

            results.push({
                product_id: item.product_id,
                level1: item.level1,
                level2: item.level2,
                level3: item.level3,
                level4: item.level4,
                sales_sum: salesRounded,
                demand_sum: demandRounded,
                prediction_final_sum: predictionRounded,
                difference: difference,
                bias_percent: biasPercent,
                osa_percent: Math.round(item.osa * 100000) / 1000,
                writeoffs_percent: Math.round(item.writeoffs * 100000) / 1000,
                accuracy_final: Math.round(item.accuracy * 100000) / 1000
            });
        });

        console.log(`Рассчитано метрик: ${results.length}`);

        return results;
    }

    calculateCoefficients(swatData, demandMetrics) {
        const results = [];

        for (const metric of demandMetrics) {
            const swatItem = swatData[metric.product_id];
            const swatValue = swatItem ? swatItem.swat_sum : 0;
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

            if (rawCoefficient === 0) {
                adjustedCoefficient = 1;
            } else if (isNaN(rawCoefficient) || !isFinite(rawCoefficient)) {
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

        // Очистка таблицы безопасным способом
        while (table.firstChild) {
            table.removeChild(table.firstChild);
        }

        // Обновляем статистику
        this.updateStats(statsGrid);

        const displayCount = Math.min(this.results.length, 10);
        const rowCountEl = document.getElementById('resultRowCount');
        if (rowCountEl) {
            rowCountEl.textContent = this.results.length === 0 ? '' : 
                `Всего строк: ${this.results.length}. Показаны первые ${displayCount}.`;
        }

        if (this.results.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 7;
            cell.className = 'text-center';
            cell.textContent = 'Нет данных для отображения';
            row.appendChild(cell);
            table.appendChild(row);
            container.style.display = 'block';
            return;
        }

        // Заполняем таблицу безопасно
        this.results.slice(0, displayCount).forEach(item => {
            const row = document.createElement('tr');

            // Создаем ячейки с безопасным содержимым
            [
                this.sanitizeText(item.level1 || ''),
                this.sanitizeText(item.level4 || ''),
                (item.sales_sum ?? 0).toLocaleString(),
                (item.demand_sum ?? 0).toLocaleString(),
                (item.prediction_final_sum ?? 0).toLocaleString(),
                (item.swat_sum ?? 0).toLocaleString()
            ].forEach((content, index) => {
                const cell = document.createElement('td');
                cell.textContent = content;
                row.appendChild(cell);
            });

            // Ячейка Difference с цветовым кодированием
            const diffCell = document.createElement('td');
            const diffValue = item.difference ?? 0;
            diffCell.className = `col-diff ${diffValue > 0 ? 'positive' : (diffValue < 0 ? 'negative' : 'neutral')}`;
            diffCell.textContent = diffValue.toLocaleString();
            row.appendChild(diffCell);
            
            table.appendChild(row);
        });

        if (this.results.length > 10) {
            const infoRow = document.createElement('tr');
            const infoCell = document.createElement('td');
            infoCell.colSpan = 7;
            infoCell.className = 'text-center text-muted';
            infoCell.textContent = `... и ещё ${this.results.length - 10} строк. Скачайте Excel файл для просмотра всех данных.`;
            infoRow.appendChild(infoCell);
            table.appendChild(infoRow);
        }

        container.style.display = 'block';
        setTimeout(() => {
            container.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    updateStats(container) {
        if (!this.results || this.results.length === 0) return;

        const total = this.results.length;
        const coef1 = this.results.filter(r => r.coefficient_adjusted === 1.00).length;
        const coef08 = this.results.filter(r => r.coefficient_adjusted === 0.80).length;
        const coef15 = this.results.filter(r => r.coefficient_adjusted === 1.50).length;

        const totalSales = this.results.reduce((sum, r) => sum + (r.sales_sum ?? 0), 0);
        const totalDemand = this.results.reduce((sum, r) => sum + (r.demand_sum ?? 0), 0);
        const totalSwat = this.results.reduce((sum, r) => sum + (r.swat_sum ?? 0), 0);
        const totalPrediction = this.results.reduce((sum, r) => sum + (r.prediction_final_sum ?? 0), 0);
        const totalDifference = totalPrediction - totalDemand;
        const avgBias = total > 0 ? this.results.reduce((sum, r) => sum + (r.bias_percent ?? 0), 0) / total : 0;

        // Безопасное создание статистики
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const stats = [
            { value: total, label: 'Всего товаров' },
            { value: coef1, label: 'Коэф = 1.00' },
            { value: coef08, label: 'Коэф = 0.80' },
            { value: coef15, label: 'Коэф = 1.50' },
            { value: totalSales.toLocaleString(), label: 'Сумма Sales' },
            { value: totalDemand.toLocaleString(), label: 'Сумма Demand' },
            { value: totalPrediction.toLocaleString(), label: 'Сумма Prediction final' },
            { value: totalSwat.toLocaleString(), label: 'Сумма SWAT' },
            { value: totalDifference.toLocaleString(), label: 'Общая разница (Pred − Demand)' },
            { value: avgBias.toFixed(2) + '%', label: 'Средний Bias' }
        ];

        stats.forEach(stat => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.cssText = `
                background: #f8f9fa;
                padding: 1.5rem;
                border-radius: 10px;
                text-align: center;
                border-top: 4px solid #3498db;
            `;

            const valueDiv = document.createElement('div');
            valueDiv.className = 'stat-value';
            valueDiv.textContent = stat.value;

            const labelDiv = document.createElement('div');
            labelDiv.className = 'stat-label';
            labelDiv.textContent = stat.label;

            card.appendChild(valueDiv);
            card.appendChild(labelDiv);
            container.appendChild(card);
        });
    }

    async downloadExcel() {
        if (!this.results || this.results.length === 0) {
            this.showAlert('warning', 'Нет данных для экспорта');
            return;
        }

        this.showLoading(true);

        try {
            const mainData = this.results.map(item => ({
                'Product ID': item.product_id,
                'Level 1': item.level1,
                'Level 2': item.level2,
                'Level 3': item.level3,
                'Level 4': item.level4,
                'Sales': item.sales_sum ?? 0,
                'Demand': item.demand_sum,
                'Prediction Final': item.prediction_final_sum,
                'SWAT': item.swat_sum,
                'Difference': item.difference,
                'Коэффициент (raw)': item.coefficient_raw,
                'Коэффициент (adjusted)': item.coefficient_adjusted,
                'Bias %': (item.bias_percent || 0) / 100,
                'OSA %': (item.osa_percent || 0) / 100,
                'Writeoffs %': (item.writeoffs_percent || 0) / 100
            }));

            const total = this.results.length;
            const coef1 = this.results.filter(r => r.coefficient_adjusted === 1.00).length;
            const coef08 = this.results.filter(r => r.coefficient_adjusted === 0.80).length;
            const coef15 = this.results.filter(r => r.coefficient_adjusted === 1.50).length;
            const coefReplacedFromZero = this.results.filter(r => r.coefficient_raw === 0).length;

            const statsData = [
                ['Статистика коэффициентов', 'Количество', 'Процент'],
                ['Коэффициент = 1.00', coef1, `${(coef1 / total * 100).toFixed(1)}%`],
                ['Коэффициент = 0.80', coef08, `${(coef08 / total * 100).toFixed(1)}%`],
                ['Коэффициент = 1.50', coef15, `${(coef15 / total * 100).toFixed(1)}%`],
                ['Другие коэффициенты', total - coef1 - coef08 - coef15, `${((total - coef1 - coef08 - coef15) / total * 100).toFixed(1)}%`],
                ['Заменено с 0 на 1 (raw = 0)', coefReplacedFromZero, `${(coefReplacedFromZero / total * 100).toFixed(1)}%`],
                ['Всего товаров', total, '100%']
            ];

            const wb = XLSX.utils.book_new();
            const ws1 = XLSX.utils.json_to_sheet(mainData);
            
            // Формат процентов
            const range = XLSX.utils.decode_range(ws1['!ref']);
            const percentColumns = {};
            
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C });
                const cell = ws1[cellAddress];
                if (cell && (
                    cell.v === 'Bias %' ||
                    cell.v === 'OSA %' ||
                    cell.v === 'Writeoffs %'
                )) {
                    percentColumns[C] = true;
                }
            }

            for (let R = range.s.r + 1; R <= range.e.r; ++R) {
                Object.keys(percentColumns).forEach(col => {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: parseInt(col) });
                    if (ws1[cellAddress]) {
                        ws1[cellAddress].z = '0.0%';
                    }
                });
            }

            XLSX.utils.book_append_sheet(wb, ws1, 'Коэффициенты и метрики');

            const ws2 = XLSX.utils.aoa_to_sheet(statsData);
            XLSX.utils.book_append_sheet(wb, ws2, 'Статистика');

            const infoData = [
                ['Параметр', 'Значение'],
                ['Дата создания отчета', new Date().toLocaleString('ru-RU')],
                ['Количество товаров', total],
                ['Рассчитанные метрики', 'Coefficient, Difference, Bias %, OSA %, Writeoffs %'],
                ['Безопасность', 'Все вычисления выполнены локально в вашем браузере'],
                ['Количество файлов DEMAND', this.demandFiles.length],
                ['Количество файлов SWAT', this.swatFiles.length]
            ];
            const ws3 = XLSX.utils.aoa_to_sheet(infoData);
            XLSX.utils.book_append_sheet(wb, ws3, 'Информация');

            // Ширина колонок
            const colWidths = [
                { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 40 }, { wch: 12 },
                { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
                { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
            ];
            ws1['!cols'] = colWidths;

            const now = new Date();
            const ts = now.getFullYear() + '-' + 
                      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(now.getDate()).padStart(2, '0') + '_' + 
                      String(now.getHours()).padStart(2, '0') + '-' + 
                      String(now.getMinutes()).padStart(2, '0') + '-' + 
                      String(now.getSeconds()).padStart(2, '0');
            const filename = `coefficients_report_${ts}.xlsx`;
            
            XLSX.writeFile(wb, filename);
            this.showAlert('success', `Файл "${filename}" успешно скачан!`);
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
            reader.onload = (e) => {
                let text = e.target.result || '';
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                resolve(text);
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.onabort = () => reject(new Error('Чтение файла прервано'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseCSV(content) {
        try {
            if (typeof content !== 'string') return [];
            content = content.replace(/^\uFEFF/, '');
            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) return [];

            const delimiter = ';';

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

                values.push(currentValue.trim().replace(/"/g, ''));

                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = values[index] !== undefined ? values[index] : '';
                });

                result.push(obj);
            }

            return result;
        } catch (error) {
            console.error('CSV parsing error:', error);
            throw new Error('Ошибка парсинга CSV файла');
        }
    }

    parseNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        let str = String(value).trim();

        if (str === '""' || str === '' || str === 'null') {
            return 0;
        }

        str = str.replace(/"/g, '');
        str = str.replace(/\s/g, '');
        str = str.replace(/,/g, '.');

        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    createProductId(level1, level4) {
        if (!level1 || !level4) return '';

        const l1 = String(level1).trim().replace(/\s+/g, '').substring(0, 50);
        const l4 = String(level4).trim().replace(/\.0$/, '').replace(/"/g, '').substring(0, 50);

        return l1 + l4;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        
        // Удаляем старые алерты
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-message alert-dismissible fade show`;
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        const messageSpan = document.createElement('span');
        messageSpan.innerHTML = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'alert');
        closeBtn.setAttribute('aria-label', 'Close');
        
        alert.appendChild(messageSpan);
        alert.appendChild(closeBtn);
        container.appendChild(alert);

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

