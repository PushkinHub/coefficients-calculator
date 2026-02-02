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
    
    // ... (остальные методы без изменений до processDemandFiles)
    
    async processDemandFiles() {
        let allData = [];
        
        for (const file of this.demandFiles) {
            const content = await this.readFile(file);
            const rows = this.parseCSV(content);
            
            console.log(`Обработка DEMAND файла: ${file.name}, строк: ${rows.length}`);
            
            for (const row of rows) {
                const measure = row['Measure Names'];
                if (!measure) continue;
                
                const value = this.parseNumber(row[''] || row.value || row.Value || 0);
                const date = row['date_scale'];
                
                const productId = this.createProductId(
                    row['level 1'] || row['level1'],
                    row['level 4'] || row['level4'],
                    date
                );
                
                allData.push({
                    product_id: productId,
                    level1: row['level 1'] || row['level1'] || '',
                    level2: row['level 2'] || row['level2'] || '',
                    level3: row['level 3'] || row['level3'] || '',
                    level4: row['level 4'] || row['level4'] || '',
                    date: date,
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
            
            switch (group.measure) {
                case 'demand':
                    aggregated[group.product_id].demand = sum;
                    break;
                case 'sales':
                    aggregated[group.product_id].sales = sum;
                    break;
                case 'prediction_final':
                    aggregated[group.product_id].prediction_final = sum;
                    break;
                case 'OSA':
                    aggregated[group.product_id].osa = sum / group.values.length; // среднее
                    break;
                case 'writeoffs_perc':
                    aggregated[group.product_id].writeoffs = sum / group.values.length; // среднее
                    break;
                case 'bias':
                    aggregated[group.product_id].bias = sum / group.values.length; // среднее
                    break;
                case 'accuracy (final)':
                    aggregated[group.product_id].accuracy = sum / group.values.length; // среднее
                    break;
            }
        });
        
        return Object.values(aggregated);
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
                const date = row['date_scale'];
                
                const productId = this.createProductId(
                    row['level 1'] || row['level1'],
                    row['level 4'] || row['level4'],
                    date
                );
                
                allSwat.push({
                    product_id: productId,
                    level1: row['level 1'] || row['level1'] || '',
                    level2: row['level 2'] || row['level2'] || '',
                    level3: row['level 3'] || row['level3'] || '',
                    level4: row['level 4'] || row['level4'] || '',
                    date: date,
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
        
        this.updateStats(statsGrid);
        
        table.innerHTML = '';
        const displayCount = Math.min(this.results.length, 50);
        
        if (this.results.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="13" class="text-center">Нет данных для отображения</td>`;
            table.appendChild(row);
            return;
        }
        
        // Порядок колонок как в Python
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>Product ID</th>
            <th>Level 1</th>
            <th>Level 2</th>
            <th>Level 3</th>
            <th>Level 4</th>
            <th>Sales</th>
            <th>Demand</th>
            <th>Prediction Final</th>
            <th>SWAT</th>
            <th>Difference</th>
            <th>Bias %</th>
            <th>Коэф (raw)</th>
            <th>Коэф (adj)</th>
        `;
        table.appendChild(headerRow);
        
        this.results.slice(0, displayCount).forEach(item => {
            const row = document.createElement('tr');
            
            const coefClass = this.getCoefficientClass(item.coefficient_adjusted);
            const diffClass = item.difference > 0 ? 'positive' : (item.difference < 0 ? 'negative' : 'neutral');
            
            const biasFormatted = (item.bias_percent || 0).toFixed(3);
            
            row.innerHTML = `
                <td>${item.product_id || ''}</td>
                <td>${item.level1 || ''}</td>
                <td>${item.level2 || ''}</td>
                <td>${item.level3 || ''}</td>
                <td>${item.level4 || ''}</td>
                <td>${item.sales_sum.toLocaleString()}</td>
                <td>${item.demand_sum.toLocaleString()}</td>
                <td>${item.prediction_final_sum.toLocaleString()}</td>
                <td>${item.swat_sum.toLocaleString()}</td>
                <td class="${diffClass}">${item.difference.toLocaleString()}</td>
                <td>${biasFormatted}%</td>
                <td class="${coefClass}">${item.coefficient_raw.toFixed(2)}</td>
                <td class="${coefClass}">${item.coefficient_adjusted.toFixed(2)}</td>
            `;
            table.appendChild(row);
        });
        
        if (this.results.length > 50) {
            const infoRow = document.createElement('tr');
            infoRow.innerHTML = `<td colspan="13" class="text-center text-muted">
                ... и ещё ${this.results.length - 50} строк. Скачайте Excel файл для просмотра всех данных.
            </td>`;
            table.appendChild(infoRow);
        }
        
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth' });
    }
    
    // ... (остальные методы без изменений)
    
    createProductId(level1, level4, date) {
        if (!level1 || !level4 || !date) return '';
        
        const l1 = String(level1).trim().replace(/\s+/g, '');
        const l4 = String(level4).trim().replace(/\.0$/, '').replace(/"/g, '');
        const d = String(date).trim().replace(/\./g, '');
        
        return `${l1}_${l4}_${d}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.calculator = new CoefficientCalculator();
});
