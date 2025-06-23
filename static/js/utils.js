const utils = {
    formatCurrency: function(value, symbol = '$') {
        if (typeof value !== 'number' || isNaN(value)) return '$NaN';
        return symbol + value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },
    
    formatPercentage: function(value) {
        if (typeof value !== 'number' || isNaN(value)) return 'NaN%';
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + '%';
    },
    
    formatNumber: function(value) {
        if (typeof value !== 'number' || isNaN(value)) return 'NaN';
        return new Intl.NumberFormat('en-US').format(value);
    }
}; 