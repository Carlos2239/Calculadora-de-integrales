document.addEventListener('DOMContentLoaded', () => {
    // Referencias a DOM
    const functionInput = document.getElementById('function-input');
    const integralType = document.getElementById('integral-type');
    const boundsGroup = document.getElementById('bounds-group');
    const lowerLimit = document.getElementById('lower-limit');
    const upperLimit = document.getElementById('upper-limit');
    const graphRange = document.getElementById('graph-range');
    const btnSolve = document.getElementById('btn-solve');
    const btnClear = document.getElementById('btn-clear');
    const btnBackspace = document.getElementById('btn-backspace');
    const btnHistoryToggle = document.getElementById('btn-history-toggle');
    const historyPanel = document.getElementById('history-panel');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const historyList = document.getElementById('history-list');
    const btnCopy = document.getElementById('btn-copy');
    const dualGraphSwitch = document.getElementById('dual-graph-switch');

    const resultsSection = document.getElementById('results-section');
    const errorAlert = document.getElementById('error-alert');
    const finalResult = document.getElementById('final-result');
    const stepsList = document.getElementById('steps-list');

    let currentGraphData = null;
    let currentIsDefinite = false;
    let currentResultLatex = "";

    // Toggle Límites
    integralType.addEventListener('change', (e) => {
        if (e.target.value === 'definite') {
            boundsGroup.style.display = 'block';
        } else {
            boundsGroup.style.display = 'none';
        }
    });

    // Control de campo activo (Teclado a qué campo apunta)
    let activeField = functionInput;
    [functionInput, lowerLimit, upperLimit].forEach(el => {
        if (el) {
            el.addEventListener('focus', () => { activeField = el; });
        }
    });

    // Lógica Teclado Virtual para input de texto plano
    const keys = document.querySelectorAll('.key');
    keys.forEach(key => {
        if (key.id === 'btn-solve' || key.id === 'btn-clear' || key.id === 'btn-backspace') return;

        key.addEventListener('click', () => {
            const val = key.getAttribute('data-val');
            if (val && activeField) {
                const start = activeField.selectionStart || 0;
                const end = activeField.selectionEnd || 0;
                const text = activeField.value || "";

                activeField.value = text.substring(0, start) + val + text.substring(end);
                activeField.focus();
                activeField.selectionStart = activeField.selectionEnd = start + val.length;
            }
        });
    });

    if (btnBackspace) {
        btnBackspace.addEventListener('click', () => {
            if (!activeField) return;
            const start = activeField.selectionStart || 0;
            const end = activeField.selectionEnd || 0;
            const text = activeField.value || "";

            if (start === end && start > 0) {
                activeField.value = text.substring(0, start - 1) + text.substring(end);
                activeField.selectionStart = activeField.selectionEnd = start - 1;
            } else if (start !== end) {
                activeField.value = text.substring(0, start) + text.substring(end);
                activeField.selectionStart = activeField.selectionEnd = start;
            }
            activeField.focus();
        });
    }

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            functionInput.value = '';
            lowerLimit.value = '';
            upperLimit.value = '';
            resultsSection.style.display = 'none';
            errorAlert.style.display = 'none';
            functionInput.focus();
        });
    }

    // Historial (localStorage)
    const loadHistory = () => {
        const history = JSON.parse(localStorage.getItem('integralHistory') || '[]');
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<p style="color:var(--text-muted); font-size: 0.9rem;">No hay integrales recientes.</p>';
            return;
        }

        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';

            // Construir representación visual en texto matemático puro (por simplicidad visual)
            let visual = `\\int \\text{${item.funcStr}} \\, dx`;
            if (item.type === 'definite') {
                visual = `\\int_{${item.lowerStr}}^{${item.upperStr}} \\text{${item.funcStr}} \\, dx`;
            }

            div.innerHTML = `
                <div class="history-item-math">\\[ ${visual} \\]</div>
            `;

            div.addEventListener('click', () => {
                functionInput.value = item.funcStr;
                integralType.value = item.type;
                boundsGroup.style.display = item.type === 'definite' ? 'block' : 'none';
                if (item.type === 'definite') {
                    lowerLimit.value = item.lowerStr;
                    upperLimit.value = item.upperStr;
                }
                historyPanel.classList.add('hidden');
            });

            historyList.appendChild(div);
        });

        if (window.MathJax) {
            window.MathJax.typesetPromise([historyList]).catch(err => console.error(err));
        }
    };

    const saveToHistory = (funcStr, type, lowerStr, upperStr) => {
        let history = JSON.parse(localStorage.getItem('integralHistory') || '[]');
        if (history.length > 0 && history[0].funcStr === funcStr && history[0].type === type) return;

        history.unshift({ funcStr, type, lowerStr, upperStr, date: new Date().toISOString() });
        if (history.length > 10) history.pop();
        localStorage.setItem('integralHistory', JSON.stringify(history));
        loadHistory();
    };

    btnHistoryToggle.addEventListener('click', () => {
        loadHistory();
        historyPanel.classList.toggle('hidden');
    });

    btnCloseHistory.addEventListener('click', () => {
        historyPanel.classList.add('hidden');
    });

    // Copiar al portapapeles
    btnCopy.addEventListener('click', () => {
        if (!currentResultLatex) return;
        navigator.clipboard.writeText(currentResultLatex).then(() => {
            const originalText = btnCopy.textContent;
            btnCopy.textContent = '¡Copiado!';
            setTimeout(() => { btnCopy.textContent = originalText; }, 2000);
        });
    });

    // Cambiar Gráfica Dual
    dualGraphSwitch.addEventListener('change', () => {
        if (currentGraphData) {
            renderGraph(currentGraphData, currentIsDefinite);
        }
    });

    // Solve logic
    if (btnSolve) {
        btnSolve.addEventListener('click', async () => {
            const funcStr = functionInput.value.trim();
            const type = integralType.value;
            const lowerStr = lowerLimit.value.trim();
            const upperStr = upperLimit.value.trim();
            const range = graphRange.value;

            if (!funcStr || funcStr === '') {
                showError("Por favor, ingresa una función matemática.");
                return;
            }

            if (type === 'definite' && (!lowerStr || !upperStr)) {
                showError("Por favor, ingresa los límites inferior y superior.");
                return;
            }

            // Spinner feedback
            const solveText = document.getElementById('solve-text');
            const solveSpinner = document.getElementById('solve-spinner');

            btnSolve.disabled = true;
            solveText.textContent = 'Calculando...';
            solveSpinner.classList.remove('hidden');
            errorAlert.style.display = 'none';
            resultsSection.style.display = 'none';

            try {
                const response = await fetch('/calculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        function: funcStr,
                        type: type,
                        lower_limit: lowerStr,
                        upper_limit: upperStr,
                        graph_range: range
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    showError(data.error);
                } else {
                    currentGraphData = data.graph;
                    currentIsDefinite = (type === 'definite');
                    currentResultLatex = data.result_latex;

                    saveToHistory(funcStr, type, lowerStr, upperStr);
                    renderResults(data, currentIsDefinite);
                }
            } catch (err) {
                showError("Error de conexión con el servidor. Verifica que Flask esté corriendo.");
            } finally {
                btnSolve.disabled = false;
                solveText.textContent = 'RESOLVER';
                solveSpinner.classList.add('hidden');
            }
        });
    }

    function showError(msg) {
        errorAlert.textContent = msg;
        errorAlert.style.display = 'flex';
        resultsSection.style.display = 'flex';
        document.querySelectorAll('.result-card').forEach(c => c.style.display = 'none');
    }

    function renderResults(data, isDefinite) {
        errorAlert.style.display = 'none';
        document.querySelectorAll('.result-card').forEach(c => c.style.display = 'block');
        resultsSection.style.display = 'flex';

        finalResult.innerHTML = `\\[ ${data.result_latex} \\]`;

        stepsList.innerHTML = '';
        data.steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = step;
            stepsList.appendChild(div);
        });

        if (window.MathJax) {
            window.MathJax.typesetPromise([finalResult, stepsList]).catch(err => console.error(err));
        }

        renderGraph(data.graph, isDefinite);
    }

    function renderGraph(graphData, isDefinite) {
        const showDual = dualGraphSwitch.checked;
        const plotData = [];

        // F(x) = Antiderivada (si está activado el switch)
        if (showDual && graphData.y_int && graphData.y_int.length > 0) {
            plotData.push({
                x: graphData.x,
                y: graphData.y_int,
                mode: 'lines',
                name: 'F(x)',
                line: { color: '#F43F5E', width: 2.5, dash: 'solid' } // Rosa
            });
        } else {
            // f(x) = Función original
            plotData.push({
                x: graphData.x,
                y: graphData.y,
                mode: 'lines',
                name: 'f(x)',
                line: { color: '#22D3EE', width: 2.5 } // Cyan
            });

            // Área sombreada solo para f(x)
            if (isDefinite && graphData.area_x && graphData.area_y) {
                plotData.push({
                    x: graphData.area_x,
                    y: graphData.area_y,
                    fill: 'tozeroy',
                    type: 'scatter',
                    mode: 'none',
                    fillcolor: 'rgba(79, 70, 229, 0.4)',
                    name: 'Área',
                    hoverinfo: 'none'
                });
            }
        }

        const layout = {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { t: 30, r: 30, b: 50, l: 50 },
            xaxis: { title: 'x', gridcolor: '#334155', zerolinecolor: '#94A3B8' },
            yaxis: { title: showDual ? 'F(x)' : 'f(x)', gridcolor: '#334155', zerolinecolor: '#94A3B8' },
            font: { color: '#F8FAFC' },
            showlegend: true,
            legend: { x: 0, y: 1 },
            hovermode: 'x unified'
        };

        Plotly.newPlot('plot-container', plotData, layout, { responsive: true, displayModeBar: false });
    }
});
