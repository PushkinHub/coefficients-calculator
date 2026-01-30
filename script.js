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
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
            if (filesArray.length < 10) {
                filesArray.push(file);
            }
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
    if (isDemand) {
        demandFiles.splice(index, 1);
        updateFileList(document.getElementById('demandFileList'), demandFiles);
    } else {
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
}

// Основная функция расчета
async function calculateCoefficients() {
    try {
        console.log('=== НАЧАЛО РАСЧЕТА ===');
        
        // Показываем спиннер
        const btn = document.getElementById('calculateBtn');
        const btnText = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        btnText.textContent = 'Идет расчет...';
        spinner.style.display = 'inline-block';
        btn.disabled = true;
        
        // Читаем файлы
        const demandData = await readCSVFiles(demandFiles, 'demand');
        const swatData = await readCSVFiles(swatFiles, 'prediction_swat');
        
        // Обрабатываем данные (как в Python)
        const processedDemand = processDataPythonStyle(demandData, 'demand_sum');
        const processedSwat = processDataPythonStyle(swatData, 'swat_sum');
        
        // Рассчитываем коэффициенты
        calculationResult = calculateCoefficientsPythonStyle(processedDemand, processedSwat);
        
        // Отображаем результаты
        displayResults(calculationResult);
        
        // Показываем секцию результатов
        document.getElementById('resultsSection').style.display = 'block';
        
        // Автоматически скачиваем если включена опция
        if (document.getElementById('autoDownload').checked) {
            setTimeout(() => {
                downloadExcel();
            }, 1000);
        }
        
        console.log('=== РАСЧЕТ УСПЕШНО ЗАВЕРШЕН ===');
        
    } catch (error) {
        console.error('Ошибка расчета:', error);
        alert('Ошибка при расчете: ' + error.message + '\n\nПроверьте консоль (F12) для подробностей.');
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

// Чтение CSV файлов (адаптировано под Python структуру)
function readCSVFiles(files, measureName) {
    return new Promise((resolve, reject) => {
        if (!files || files.length === 0) {
            reject(new Error(`Нет файлов для ${measureName}`));
            return;
        }
        
        const allData = [];
        let filesRead = 0;
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const text = e.target.result;
                    
                    // Используем PapaParse для парсинга CSV
                    const results = Papa.parse(text, {
                        delimiter: ';',
                        header: true,
                        skipEmptyLines: true,
                        transform: (value) => {
                            // Заменяем запятые на точки в числах
                            if (value && typeof value === 'string' && value.includes(',')) {
                                return value.replace(',', '.');
                            }
                            return value;
                        }
                    });
                    
                    // Фильтруем по Measure Names (как в Python)
                    const filtered = results.data.filter(row => {
                        if (!row['Measure Names']) return false;
                        // Приводим к нижнему регистру для надежности
                        return row['Measure Names'].toLowerCase() === measureName.toLowerCase();
                    });
                    
                    allData.push(...filtered);
                    
                } catch (error) {
                    console.error('Ошибка парсинга файла', file.name, error);
                }
                
                filesRead++;
                if (filesRead === files.length) {
                    if (allData.length === 0) {
                        reject(new Error(`Не найдено данных с Measure Names = "${measureName}"`));
                    } else {
                        console.log(`Для ${measureName} загружено ${allData.length} строк`);
                        resolve(allData);
                    }
                }
            };
            
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    });
}

// Обработка данных как в Python
function processDataPythonStyle(data, sumColumn) {
    console.log(`Обработка ${data.length} строк для ${sumColumn}`);
    
    const grouped = {};
    
    data.forEach(row => {
        try {
            // Создаем уникальный идентификатор товара как в Python
            const level1 = (row['level 1'] || '').toString().trim().replace(/\s+/g, '');
            const level4 = (row['level 4'] || '').toString().trim().replace(/\.0$/, '');
            const productId = level1 + level4;
            
            if (!productId) return;
            
            if (!grouped[productId]) {
                grouped[productId] = {
                    product_id: productId,
                    level1: row['level 1'],
                    level2: row['level 2'],
                    level3: row['level 3'],
                    level4: row['level 4'],
                    sum: 0
                };
            }
            
            // Преобразуем значение в число (ищем в последней колонке как в Python)
            let value = 0;
            const keys = Object.keys(row);
            const lastCol = keys[keys.length - 1];
            
            if (lastCol && lastCol !== 'Measure Names') {
                value = parseFloat(row[lastCol]) || 0;
            }
            
            grouped[productId].sum += value;
            
        } catch (error) {
            console.error('Ошибка обработки строки:', error, row);
        }
    });
    
    const result = Object.values(grouped).map(item => ({
        ...item,
        [sumColumn]: item.sum
    }));
    
    console.log(`Сгруппировано ${result.length} товаров для ${sumColumn}`);
    return result;
}

// Расчет коэффициентов как в Python
function calculateCoefficientsPythonStyle(demandData, swatData) {
    console.log('Расчет коэффициентов по Python-логике...');
    
    // Создаем мапы для быстрого доступа
    const demandMap = new Map();
    demandData.forEach(item => {
        demandMap.set(item.product_id, item);
    });
    
    const swatMap = new Map();
    swatData.forEach(item => {
        swatMap.set(item.product_id, item);
    });
    
    // Объединяем все product_id
    const allProductIds = new Set([
        ...demandData.map(d => d.product_id),
        ...swatData.map(s => s.product_id)
    ]);
    
    const results = [];
    
    allProductIds.forEach(productId => {
        const demand = demandMap.get(productId);
        const swat = swatMap.get(productId);
        
        const demandSum = demand ? demand.demand_sum : 0;
        const swatSum = swat ? swat.swat_sum : 0;
        
        // Вычисляем исходный коэффициент
        let coefficientExact = 0;
        if (swatSum !== 0) {
            coefficientExact = demandSum / swatSum;
        }
        
        // ШАГ 1: Округляем до 2 знаков после запятой
        let coefficientRaw = Math.round(coefficientExact * 100) / 100;
        
        // ШАГ 2: Применяем правила корректировки
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
        
        // Округляем суммы (математическое округление)
        const demandRounded = Math.round(demandSum);
        const swatRounded = Math.round(swatSum);
        
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
    
    result.results.slice(0, 10).forEach(row => {
        const tr = document.createElement('tr');
        
        // Определяем маркер как в Python
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
}

// Создание Excel файла
function downloadExcel() {
    if (!calculationResult) {
        alert('Сначала выполните расчет!');
        return;
    }
    
    try {
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
            ['Всего обработано товаров', calculationResult.statistics.total],
            ['Версия приложения', '1.0 (адаптировано из Python)']
        ];
        
        const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Информация');
        
        // Генерируем и скачиваем файл
        const filename = `coefficients_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        alert(`Файл ${filename} успешно скачан!`);
        
    } catch (error) {
        alert('Ошибка при создании Excel файла: ' + error.message);
        console.error(error);
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
        </div>
    `;
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

// Закрыть модальное окно
function closeModal() {
    document.getElementById('detailsModal').style.display = 'none';
}

// ==================== DEBUG ФУНКЦИИ ====================

// Дебаг функция
window.debugFiles = function() {
    console.clear();
    console.log('=== DEBUG FILES ===');
    console.log('DEMAND файлов:', demandFiles.length);
    console.log('SWAT файлов:', swatFiles.length);
    
    if (demandFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('\n=== DEMAND FILE STRUCTURE ===');
            analyzeFileStructure(e.target.result, 'demand');
        };
        reader.readAsText(demandFiles[0]);
    }
    
    if (swatFiles.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            console.log('\n=== SWAT FILE STRUCTURE ===');
            analyzeFileStructure(e.target.result, 'prediction_swat');
        };
        reader.readAsText(swatFiles[0]);
    }
};

// Тест чтения файла
window.testFileRead = function() {
    console.clear();
    console.log('=== TEST FILE READ ===');
    
    const file = demandFiles[0] || swatFiles[0];
    if (!file) {
        console.log('Нет файлов для теста');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        console.log('=== RAW FILE ANALYSIS ===');
        console.log('Файл:', file.name);
        console.log('Размер:', text.length, 'символов');
        
        const lines = text.split('\n');
        console.log('Всего строк:', lines.length);
        
        if (lines.length > 0) {
            console.log('Первая строка (заголовки):', lines[0]);
            
            // Проверяем структуру
            const delimiter = detectDelimiter(lines[0]);
            console.log('Разделитель:', delimiter);
            
            if (lines.length > 1) {
                console.log('Вторая строка (данные):', lines[1]);
                
                const headers = lines[0].split(delimiter);
                const data = lines[1].split(delimiter);
                
                console.log('Структура строки:');
                headers.forEach((header, i) => {
                    console.log(`  ${header}: ${data[i] || '(пусто)'}`);
                });
            }
        }
    };
    reader.readAsText(file);
};

// Вспомогательные функции для дебага
function analyzeFileStructure(text, expectedMeasure) {
    const lines = text.split('\n');
    console.log('Всего строк:', lines.length);
    
    if (lines.length > 0) {
        const delimiter = detectDelimiter(lines[0]);
        console.log('Разделитель:', delimiter);
        
        const headers = lines[0].split(delimiter);
        console.log('Заголовки:', headers);
        
        // Проверяем наличие обязательных колонок
        const required = ['Measure Names', 'level 1', 'level 2', 'level 3', 'level 4'];
        const missing = required.filter(col => !headers.includes(col));
        if (missing.length > 0) {
            console.warn('Отсутствуют колонки:', missing);
        }
        
        // Анализируем Measure Names
        const measureNames = [];
        for (let i = 1; i < Math.min(10, lines.length); i++) {
            if (lines[i].trim()) {
                const parts = lines[i].split(delimiter);
                const measureIndex = headers.indexOf('Measure Names');
                if (measureIndex !== -1 && parts[measureIndex]) {
                    measureNames.push(parts[measureIndex]);
                }
            }
        }
        
        console.log('Уникальные Measure Names (первые 10):', [...new Set(measureNames)]);
        
        // Проверяем есть ли ожидаемый measure
        if (expectedMeasure && !measureNames.includes(expectedMeasure)) {
            console.warn(`Внимание: Не найден ожидаемый Measure Names = "${expectedMeasure}"`);
        }
    }
}

function detectDelimiter(line) {
    const delimiters = [';', ',', '\t'];
    let bestDelimiter = ';';
    let maxCount = 0;
    
    delimiters.forEach(delim => {
        const count = (line.match(new RegExp(delim, 'g')) || []).length;
        if (count > maxCount) {
            maxCount = count;
            bestDelimiter = delim;
        }
    });
    
    return bestDelimiter;
}
