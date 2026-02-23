document.addEventListener('DOMContentLoaded', () => {
    const functionInput = document.getElementById('function-input');
    const integralType = document.getElementById('integral-type');
    const boundsGroup = document.getElementById('bounds-group');
    const lowerLimit = document.getElementById('lower-limit');
    const upperLimit = document.getElementById('upper-limit');
    const graphRange = document.getElementById('graph-range');
    const btnSolve = document.getElementById('btn-solve');
    const btnClear = document.getElementById('btn-clear');
    const btnBackspace = document.getElementById('btn-backspace');
    const resultsSection = document.getElementById('results-section');
    const errorAlert = document.getElementById('error-alert');
    const finalResult = document.getElementById('final-result');
    const stepsList = document.getElementById('steps-list');
    
    // Toggle bounds visibility
    integralType.addEventListener('change', (e) => {
        if (e.target.value === 'definite') {
            boundsGroup.style.display = 'block';
        } else {
            boundsGroup.style.display = 'none';
        }
    });

    // Keypad Logic
    const keys = document.querySelectorAll('.key');
    let lastActiveInput = functionInput; // tracks which input to append to

    [functionInput, lowerLimit, upperLimit].forEach(input => {
        if(input) {
            input.addEventListener('focus', () => {
                lastActiveInput = input;
            });
        }
    });

    keys.forEach(key => {
        if (key.id === 'btn-solve' || key.id === 'btn-clear' || key.id === 'btn-backspace') return;
        
        key.addEventListener('click', () => {
            const val = key.getAttribute('data-val');
            if (val && lastActiveInput) {
                // insert at cursor position
                const start = lastActiveInput.selectionStart || 0;
                const end = lastActiveInput.selectionEnd || 0;
                const text = lastActiveInput.value || "";
                
                lastActiveInput.value = text.substring(0, start) + val + text.substring(end);
                lastActiveInput.focus();
                // Set cursor right after inserted text
                lastActiveInput.selectionStart = lastActiveInput.selectionEnd = start + val.length;
            }
        });
    });

    if (btnBackspace) {
        btnBackspace.addEventListener('click', () => {
            if (!lastActiveInput) return;
            const start = lastActiveInput.selectionStart || 0;
            const end = lastActiveInput.selectionEnd || 0;
            const text = lastActiveInput.value || "";

            if (start === end && start > 0) {
                lastActiveInput.value = text.substring(0, start - 1) + text.substring(end);
                lastActiveInput.selectionStart = lastActiveInput.selectionEnd = start - 1;
            } else if (start !== end) {
                lastActiveInput.value = text.substring(0, start) + text.substring(end);
                lastActiveInput.selectionStart = lastActiveInput.selectionEnd = start;
            }
            lastActiveInput.focus();
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

    // Solve logic
    if (btnSolve) {
        btnSolve.addEventListener('click', async () => {
            const funcStr = functionInput.value.trim();
            const type = integralType.value;
            const lower = lowerLimit.value.trim();
            const upper = upperLimit.value.trim();
            const range = graphRange.value;

            if (!funcStr) {
                showError("Por favor, ingresa una función matemática.");
                return;
            }

            if (type === 'definite' && (lower === '' || upper === '')) {
                showError("Por favor, ingresa los límites inferior y superior.");
                return;
            }

            // Show loading state
            btnSolve.disabled = true;
            btnSolve.textContent = 'Calculando...';
            errorAlert.style.display = 'none';
            resultsSection.style.display = 'none';

            try {
                const response = await fetch('/calculate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        function: funcStr,
                        type: type,
                        lower_limit: lower,
                        upper_limit: upper,
                        graph_range: range
                    })
                });

                const data = await response.json();

                if (!data.success) {
                    showError(data.error);
                } else {
                    renderResults(data, type === 'definite');
                }
            } catch (err) {
                showError("Error de conexión con el servidor. Verifica que Flask esté corriendo.");
            } finally {
                btnSolve.disabled = false;
                btnSolve.textContent = 'RESOLVER';
            }
        });
    }

    function showError(msg) {
        errorAlert.textContent = msg;
        errorAlert.style.display = 'block';
        resultsSection.style.display = 'flex';
        // hide other cards
        document.querySelectorAll('.result-card').forEach(c => c.style.display = 'none');
    }

    function renderResults(data, isDefinite) {
        errorAlert.style.display = 'none';
        document.querySelectorAll('.result-card').forEach(c => c.style.display = 'block');
        resultsSection.style.display = 'flex';

        // Render MathJax Result
        finalResult.innerHTML = `\\[ ${data.result_latex} \\]`;
        
        // Render Steps
        stepsList.innerHTML = '';
        data.steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'step-item';
            div.innerHTML = step; // MathJax will automatically find \( \)
            stepsList.appendChild(div);
        });

        // Trigger MathJax render
        if (window.MathJax) {
            window.MathJax.typesetPromise([finalResult, stepsList]).catch(err => console.error(err));
        }

        // Render Graph
        renderGraph(data.graph, isDefinite);
    }

    function renderGraph(graphData, isDefinite) {
        const trace = {
            x: graphData.x,
            y: graphData.y,
            mode: 'lines',
            name: 'f(x)',
            line: { color: '#22D3EE', width: 2.5 }
        };

        const plotData = [trace];

        if (isDefinite && graphData.area_x && graphData.area_y) {
            const areaTrace = {
                x: graphData.area_x,
                y: graphData.area_y,
                fill: 'tozeroy',
                type: 'scatter',
                mode: 'none',
                fillcolor: 'rgba(79, 70, 229, 0.4)',
                name: 'Área',
                hoverinfo: 'none'
            };
            plotData.push(areaTrace);
        }

        const layout = {
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { t: 30, r: 30, b: 50, l: 50 },
            xaxis: {
                title: 'x',
                gridcolor: '#334155',
                zerolinecolor: '#94A3B8'
            },
            yaxis: {
                title: 'f(x)',
                gridcolor: '#334155',
                zerolinecolor: '#94A3B8'
            },
            font: { color: '#F8FAFC' },
            showlegend: false,
            hovermode: 'x unified'
        };

        const config = { responsive: true, displayModeBar: false };

        Plotly.newPlot('plot-container', plotData, layout, config);
    }
});
