// Глобальные переменные
let demandFiles = [];
let swatFiles = [];
let calculationResult = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    console.log('Инициализация приложения...');
    setupFileUpload('demandFiles', 'demandUploadArea', 'demandFileList', demandFiles);
    setupFileUpload('swatFiles', 'swatUploadArea', 'swatFileList', swatFiles);
    updateCalculateButton();
});

// Настройка загрузки файлов
function setupFileUpload(inputId, dropAreaId, fileListId, filesArray) {
    const input = document.getElementById(inputId);
    const dropArea = document.getElementById(dropAreaId);
    const fileList = document.getElementById(fileListId);
    
    // Обработка перетаскивания
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropArea.classList.add('drag-over');
    }
    
    function unhighlight() {
        dropArea.classList.remove('drag-over');
    }
    
    // Обработка drop
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, filesArray, fileList);
    }
    
    // Обработка выбора файлов
    input.addEventListener('change', function() {
        handleFiles(this.files, filesArray, fileList);
    });
}

// Обработка файлов
function handleFiles(files, filesArray, fileList) {
    console.log(`Получено файлов: ${files.length}`);
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Файл ${i}: ${file.name}, тип: ${file.type}, размер: ${file.size} байт`);
        
        if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
            if (filesArray.length < 10) { // Ограничение на количество файлов
                filesArray.push(file);
                console.log(`Добавлен файл: ${file.name}`);
            } else {
                console.log(`Пропущен файл ${file.name}: превышено максимальное количество файлов`);
            }
        } else {
            console.warn(`Пропущен файл ${file.name}: не CSV формат`);
        }
    }
    
    updateFileList(fileList, filesArray);
    updateCalculateButton();
}

// Обновление списка файлов
function updateFileList(fileListElement, filesArray) {
    fileListElement.innerHTML = '';
    
    if (filesArray.length === 0) {
        return;
    }
    
    filesArray.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#667eea" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
                <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
            <button class="remove-btn" onclick="removeFile(${index}, ${filesArray === demandFiles})">×</button>
        `;
        fileListElement.appendChild(fileItem);
    });
}

// Удаление файла
function removeFile(index, isDemand) {
    console.log(`Удаление файла ${index}, isDemand: ${isDemand}`);
    
    if (isDemand) {
        console.log(`Удален DEMAND файл: ${demandFiles[index].name}`);
        demandFiles.splice(index, 1);
        updateFileList(document.getElementById('demandFileList'), demandFiles);
    } else {
        console.log(`Удален SWAT файл: ${swatFiles[index].name}`);
        swatFiles.splice(index, 1);
        updateFileList(document.getElementById('swatFileList'), swatFiles);
    }
    updateCalculateButton();
}

// Обновление кнопки расчета
function updateCalculateButton() {
    const calculateBtn = document.getElementById('calculateBtn');
    const isEnabled = demandFiles.length > 0 && swatFiles.length > 0;
    calculateBtn.disabled = !isEnabled;
    console.log(`Кнопка расчета: ${isEnabled ? 'активна' : 'неактивна'}`);
}

// Основная функция расчета
async function calculateCoefficients() {
    try {
        console.log('=== НАЧАЛО РАСЧЕТА ===');
        console.log(`DEMAND файлов: ${demandFiles.length}`);
        console.log(`SWAT файлов: ${swatFiles.length}`);
        
        // Показываем спиннер
        const btn = document.getElementById('calculateBtn');
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        btnText.textContent = 'Идет расчет...';
        spinner.style.display = 'inline-block';
        btn.disabled = true;
        
        // Читаем файлы
        console.log('Чтение DEMAND файлов...');
        const demandData = await readCSVFiles(demandFiles, 'demand');
        console.log(`DEMAND данных прочитано: ${demandData.length}`);
        
        console.log('Чтение SWAT файлов...');
        const swatData = await readCSVFiles(swatFiles, 'prediction_swat');
        console.log(`SWAT данных прочитано: ${swatData.length}`);
        
        // Проверяем что есть данные
        if (demandData.length === 0) {
            throw new Error('Не удалось прочитать данные DEMAND. Проверьте формат файлов.');
        }
        if (swatData.length === 0) {
            throw new Error('Не удалось прочитать данные SWAT. Проверьте формат файлов.');
        }
        
        // Обрабатываем данные
        console.log('Обработка DEMAND данных...');
        const processedDemand = processData(demandData, 'demand_sum');
        console.log(`Обработано DEMAND записей: ${processedDemand.length}`);
        
        console.log('Обработка SWAT данных...');
        const processedSwat = processData(swatData, 'swat_sum');
        console.log(`Обработано SWAT записей: ${processedSwat.length}`);
        
        // Проверяем что есть обработанные данные
        if (processedDemand.length === 0) {
            throw new Error('Не удалось обработать данные DEMAND. Проверьте структуру файлов.');
        }
        if (processedSwat.length === 0) {
            throw new Error('Не удалось обработать данные SWAT. Проверьте структуру файлов.');
        }
        
        // Рассчитываем коэффициенты
        console.log('Расчет коэффициентов...');
        calculationResult = calculate(processedDemand, processedSwat);
        console.log(`Рассчитано коэффициентов: ${calculationResult.results.length}`);
        
        // Отображаем результаты
        displayResults(calculationResult);
        
        // Показываем секцию результатов
        document.getElementById('resultsSection').style.display = 'block';
        console.log('Результаты отображены');
        
        // Автоматически скачиваем если включена опция
        if (document.getElementById('autoDownload').checked) {
            console.log('Автоматическое скачивание...');
            setTimeout(() => {
                downloadExcel();
            }, 1000);
        }
        
        console.log('=== РАСЧЕТ УСПЕШНО ЗАВЕРШЕН ===');
        
    } catch (error) {
        console.error('=== ОШИБКА РАСЧЕТА ===');
        console.error('Сообщение:', error.message);
        console.error('Стек:', error.stack);
        
        let errorMessage = 'Ошибка при расчете: ' + error.message;
        
        // Добавляем дополнительные подсказки
        if (error.message.includes('undefined')) {
            errorMessage += '\n\nВозможные причины:';
            errorMessage += '\n1. Файлы имеют неправильную структуру';
            errorMessage += '\n2. Отсутствуют необходимые колонки';
            errorMessage += '\n3. Неправильный разделитель в CSV файле';
            errorMessage += '\n\nНажмите кнопку "Debug" для просмотра содержимого файлов.';
        }
        
        alert(errorMessage);
    } finally {
        // Восстанавливаем кнопку
        const btn = document.getElementById('calculateBtn');
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        btnText.textContent = 'Рассчитать коэффициенты';
        spinner.style.display = 'none';
        updateCalculateButton();
    }
}

// Чтение CSV файлов
function readCSVFiles(files, measureName) {
    return new Promise((resolve, reject) => {
        const allData = [];
        let filesRead = 0;
        
        if (files.length === 0) {
            reject(new Error(`Нет файлов для ${measureName}`));
            return;
        }
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    console.log(`Чтение файла ${file.name} для ${measureName}`);
                    
                    // Используем PapaParse для парсинга CSV
                    const results = Papa.parse(text, {
                        delimiter: ';',
                        header: true,
                        skipEmptyLines: true,
                        transform: (value, column) => {
                            // Заменяем запятые на точки в числах
                            if (value && typeof value === 'string' && value.includes(',')) {
                                return value.replace(',', '.');
                            }
                            return value;
                        }
                    });
                    
                    console.log(`Найдено строк: ${results.data.length}`);
                    
                    // Фильтруем по Measure Names
                    const filtered = results.data.filter(row => {
                        // Проверяем наличие поля 'Measure Names'
                        if (!row['Measure Names']) {
                            console.warn('Строка без Measure Names:', row);
                            return false;
                        }
                        const measureValue = row['Measure Names'];
                        const isMatch = measureValue === measureName;
                        if (!isMatch) {
                            console.log(`Пропущена строка: ${measureValue} !== ${measureName}`);
                        }
                        return isMatch;
                    });
                    
                    console.log(`Отфильтровано для ${measureName}: ${filtered.length}`);
                    
                    // Дебаг: посмотрим первую строку
                    if (filtered.length > 0) {
                        console.log('Первая строка данных:', filtered[0]);
                        console.log('Ключи первой строки:', Object.keys(filtered[0]));
                    } else {
                        console.warn(`Не найдено данных для ${measureName} в файле ${file.name}`);
                        console.log('Примеры Measure Names в файле:', 
                            results.data.slice(0, 5).map(r => r['Measure Names']).filter(Boolean));
                    }
                    
                    allData.push(...filtered);
                    
                    filesRead++;
                    if (filesRead === files.length) {
                        console.log(`Всего данных для ${measureName}: ${allData.length}`);
                        resolve(allData);
                    }
                } catch (error) {
                    console.error('Ошибка при парсинге файла:', error);
                    console.error('Файл:', file.name);
                    reject(new Error(`Ошибка парсинга файла ${file.name}: ${error.message}`));
                }
            };
            reader.onerror = function(e) {
                console.error('Ошибка чтения файла:', e);
                reject(new Error(`Не удалось прочитать файл ${file.name}`));
            };
            reader.readAsText(file, 'UTF-8');
        });
    });
}

// Обработка данных
function processData(data, sumColumn) {
    console.log(`Обработка ${data.length} строк для ${sumColumn}`);
    
    if (data.length === 0) {
        console.warn('Нет данных для обработки');
        return [];
    }
    
    const grouped = {};
    
    data.forEach((row, index) => {
        try {
            // Дебаг для первых нескольких строк
            if (index < 3) {
                console.log(`Строка ${index}:`, row);
                console.log('Ключи:', Object.keys(row));
            }
            
            // Создаем уникальный идентификатор
            const level1 = (row['level 1'] || '').toString().trim().replace(/\s+/g, '');
            const level4 = (row['level 4'] || '').toString().trim().replace(/\.0$/, '');
            const productId = level1 + level4;
            
            if (!productId) {
                console.warn('Пропущена строка без productId:', row);
                return;
            }
            
            if (!grouped[productId]) {
                grouped[productId] = {
                    product_id: productId,
                    level1: row['level 1'],
                    level2: row['level 2'],
                    level3: row['level 3'],
                    level4: row['level 4'],
                    sum: 0,
                    details: []
                };
            }
            
            // Ищем значение в колонках
            let value = 0;
            const valueKeys = ['value', 'Value', 'VALUE', 'значение', 'Значение'];
            
            for (const key of valueKeys) {
                if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                    const val = parseFloat(row[key]);
                    if (!isNaN(val)) {
                        value = val;
                        break;
                    }
                }
            }
            
            // Если не нашли в стандартных ключах, ищем числовую колонку
            if (value === 0) {
                const keys = Object.keys(row);
                for (const key of keys) {
                    // Пропускаем нечисловые колонки
                    if (['Measure Names', 'level 1', 'level 2', 'level 3', 'level 4', 'date_scale'].includes(key)) {
                        continue;
                    }
                    
                    const val = parseFloat(row[key]);
                    if (!isNaN(val)) {
                        value = val;
                        console.log(`Найдено значение в колонке ${key}: ${value}`);
                        break;
                    }
                }
            }
            
            grouped[productId].sum += value;
            grouped[productId].details.push({
                value: value,
                date: row['date_scale'] || row['date_scale'] || '',
                file: 'загруженный файл'
            });
            
        } catch (error) {
            console.error(`Ошибка обработки строки ${index}:`, error, row);
        }
    });
    
    // Преобразуем в массив
    const result = Object.values(grouped).map(item => ({
        ...item,
        [sumColumn]: item.sum
    }));
    
    console.log(`Сгруппировано ${result.length} товаров для ${sumColumn}`);
    if (result.length > 0) {
        console.log('Пример сгруппированной записи:', result[0]);
    } else {
        console.warn('Не удалось сгруппировать данные!');
    }
    
    return result;
}

// Расчет коэффициентов
function calculate(demandData, swatData) {
    console.log('Начало расчета коэффициентов...');
    
    // Создаем мапу для быстрого доступа
    const demandMap = new Map();
    demandData.forEach(item => {
        demandMap.set(item.product_id, item);
    });
    
    const swatMap = new Map();
    swatData.forEach(item => {
        swatMap.set(item.product_id, item);
    });
    
    // Объединяем данные
    const allProductIds = new Set([
        ...demandData.map(d => d.product_id),
        ...swatData.map(s => s.product_id)
    ]);
    
    console.log(`Всего уникальных product_id: ${allProductIds.size}`);
    
    const results = [];
    
    allProductIds.forEach(productId => {
        const demand = demandMap.get(productId);
        const swat = swatMap.get(productId);
        
        const demandSum = demand ? demand.demand_sum : 0;
        const swatSum = swat ? swat.swat_sum : 0;
        
        // Округляем суммы
        const demandRounded = Math.round(demandSum);
        const swatRounded = Math.round(swatSum);
        
        // Вычисляем коэффициент
        let coefficientRaw = 0;
        if (swatRounded !== 0) {
            coefficientRaw = demandRounded / swatRounded;
        }
        
        // Округляем до 2 знаков
        coefficientRaw = Math.round(coefficientRaw * 100) / 100;
        
        // Применяем правила корректировки
        let coefficientAdjusted = coefficientRaw;
        let adjustmentType = 'none';
        
        if (coefficientRaw >= 0.96 && coefficientRaw <= 1.04) {
            coefficientAdjusted = 1.00;
            adjustmentType = 'range';
        } else if (coefficientRaw < 0.8) {
            coefficientAdjusted = 0.80;
            adjustmentType = 'min';
        } else if (coefficientRaw > 1.5) {
            coefficientAdjusted = 1.50;
            adjustmentType = 'max';
        }
        
        results.push({
            product_id: productId,
            level3: demand ? demand.level3 : (swat ? swat.level3 : ''),
            coefficient_raw: coefficientRaw,
            coefficient_adjusted: coefficientAdjusted,
            demand_sum: demandRounded,
            swat_sum: swatRounded,
            adjustment_type: adjustmentType
        });
    });
    
    // Сортируем по product_id
    results.sort((a, b) => a.product_id.localeCompare(b.product_id));
    
    console.log(`Рассчитано коэффициентов: ${results.length}`);
    
    return {
        results: results,
        statistics: calculateStatistics(results)
    };
}

// Расчет статистики
function calculateStatistics(results) {
    const stats = {
        total: results.length,
        coeff_100: results.filter(r => r.coefficient_adjusted === 1.00).length,
        coeff_08: results.filter(r => r.coefficient_adjusted === 0.80).length,
        coeff_15: results.filter(r => r.coefficient_adjusted === 1.50).length,
        other: results.filter(r => r.coefficient_adjusted !== 1.00 && 
                                  r.coefficient_adjusted !== 0.80 && 
                                  r.coefficient_adjusted !== 1.50).length
    };
    
    console.log('Статистика расчета:', stats);
    
    return stats;
}

// Отображение результатов
function displayResults(result) {
    const stats = result.statistics;
    
    // Обновляем статистику
    document.getElementById('totalProducts').textContent = stats.total;
    document.getElementById('coeff100').textContent = stats.coeff_100;
    document.getElementById('coeff08').textContent = stats.coeff_08;
    document.getElementById('coeff15').textContent = stats.coeff_15;
    
    // Заполняем таблицу предпросмотра
    const tableBody = document.querySelector('#previewTable tbody');
    tableBody.innerHTML = '';
    
    const previewRows = Math.min(10, result.results.length);
    console.log(`Отображение предпросмотра ${previewRows} строк`);
    
    result.results.slice(0, previewRows).forEach(row => {
        const tr = document.createElement('tr');
        
        // Определяем маркер
        let marker = '';
        if (row.coefficient_raw !== row.coefficient_adjusted) {
            if (row.coefficient_raw >= 0.96 && row.coefficient_raw <= 1.04) {
                marker = '*';
            } else {
                marker = '**';
            }
        }
        
        tr.innerHTML = `
            <td>${row.product_id}</td>
            <td>${(row.level3 || '').slice(0, 40)}${(row.level3 || '').length > 40 ? '...' : ''}</td>
            <td>${row.coefficient_raw.toFixed(2)}${marker}</td>
            <td>${row.coefficient_adjusted.toFixed(2)}</td>
            <td>${row.demand_sum}</td>
            <td>${row.swat_sum}</td>
        `;
        tableBody.appendChild(tr);
    });
    
    console.log('Предпросмотр отображен');
}

// Создание Excel файла
function downloadExcel() {
    if (!calculationResult) {
        alert('Сначала выполните расчет!');
        return;
    }
    
    try {
        console.log('Создание Excel файла...');
        
        // Создаем книгу Excel
        const wb = XLSX.utils.book_new();
        
        // 1. Лист с коэффициентами
        const wsData = calculationResult.results.map(row => ({
            'Product ID': row.product_id,
            'Level 3': row.level3,
            'Coefficient Raw': row.coefficient_raw,
            'Coefficient Adjusted': row.coefficient_adjusted,
            'Demand': row.demand_sum,
            'SWAT': row.swat_sum,
            'Adjustment Type': row.adjustment_type
        }));
        
        const ws = XLSX.utils.json_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Коэффициенты');
        
        // 2. Лист со статистикой
        const statsData = [
            ['Показатель', 'Количество', 'Процент'],
            ['Всего товаров', calculationResult.statistics.total, '100%'],
            ['Коэффициент = 1.00', calculationResult.statistics.coeff_100, 
             `${(calculationResult.statistics.coeff_100 / calculationResult.statistics.total * 100).toFixed(1)}%`],
            ['Коэффициент = 0.80', calculationResult.statistics.coeff_08,
             `${(calculationResult.statistics.coeff_08 / calculationResult.statistics.total * 100).toFixed(1)}%`],
            ['Коэффициент = 1.50', calculationResult.statistics.coeff_15,
             `${(calculationResult.statistics.coeff_15 / calculationResult.statistics.total * 100).toFixed(1)}%`],
            ['Другие коэффициенты', calculationResult.statistics.other,
             `${(calculationResult.statistics.other / calculationResult.statistics.total * 100).toFixed(1)}%`]
        ];
        
        const wsStats = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, wsStats, 'Статистика');
        
        // 3. Лист с информацией
        const infoData = [
            ['Параметр', 'Значение'],
            ['Дата создания', new Date().toLocaleString('ru-RU')],
            ['Количество файлов DEMAND', demandFiles.length],
            ['Количество файлов SWAT', swatFiles.length],
            ['Всего обработано товаров', calculationResult.statistics.total]
        ];
        
        const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Информация');
        
        // Генерируем и скачиваем файл
        const filename = `coefficients_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log(`Файл ${filename} создан и скачан`);
        alert(`Файл ${filename} успешно скачан!`);
        
    } catch (error) {
        console.error('Ошибка при создании Excel файла:', error);
        alert('Ошибка при создании Excel файла: ' + error.message);
    }
}

// Показать детальную статистику
function showDetails() {
    if (!calculationResult) return;
    
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailedStats');
    
    const stats = calculationResult.statistics;
    
    let html = `
        <div class="detailed-stats">
            <h3>Распределение коэффициентов</h3>
            <div class="progress-grid">
    `;
    
    const categories = [
        { label: '= 1.00', value: stats.coeff_100, color: '#28a745' },
        { label: '= 0.80', value: stats.coeff_08, color: '#dc3545' },
        { label: '= 1.50', value: stats.coeff_15, color: '#ffc107' },
        { label: 'Другие', value: stats.other, color: '#17a2b8' }
    ];
    
    categories.forEach(cat => {
        const percent = (cat.value / stats.total * 100).toFixed(1);
        html += `
            <div class="progress-item">
                <div class="progress-label">
                    <span>${cat.label}</span>
                    <span>${cat.value} (${percent}%)</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%; background: ${cat.color};"></div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
            <h3>Примеры корректировок</h3>
            <div class="examples">
    `;
    
    // Показываем несколько примеров корректировок
    const examples = calculationResult.results
        .filter(r => r.coefficient_raw !== r.coefficient_adjusted)
        .slice(0, 5);
    
    if (examples.length > 0) {
        examples.forEach((ex, i) => {
            html += `
                <div class="example-item">
                    <div><strong>${ex.product_id}</strong></div>
                    <div>${(ex.level3 || '').slice(0, 50)}...</div>
                    <div class="example-values">
                        <span class="coeff-raw">${ex.coefficient_raw.toFixed(2)}</span>
                        <span> → </span>
                        <span class="coeff-adj">${ex.coefficient_adjusted.toFixed(2)}</span>
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p>Корректировки не применялись</p>';
    }
    
    html += `
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('detailsModal').style.display = 'none';
}
