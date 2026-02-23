from flask import Flask, request, jsonify, render_template
import sympy as sp
import numpy as np

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    func_str = data.get('function', '')
    is_definite = data.get('type') == 'definite'
    lower_limit_str = data.get('lower_limit', '')
    upper_limit_str = data.get('upper_limit', '')
    graph_range_str = data.get('graph_range', '-10,10')
    
    try:
        x = sp.Symbol('x')
        func_str_sp = func_str.replace('^', '**')
        f = sp.sympify(func_str_sp)
        
        steps = []
        steps.append(f"1. Identificamos la función a integrar: \\( f(x) = {sp.latex(f)} \\)")
        
        if is_definite:
            lower = float(sp.sympify(str(lower_limit_str).replace('^', '**')))
            upper = float(sp.sympify(str(upper_limit_str).replace('^', '**')))
            
            steps.append(f"2. Evaluamos los límites de integración: de \\( a = {lower} \\) a \\( b = {upper} \\).")
            
            indefinite_integral = sp.integrate(f, x)
            steps.append(f"3. Calculamos la antiderivada: \\( F(x) = {sp.latex(indefinite_integral)} \\)")
            
            result = sp.integrate(f, (x, lower, upper))
            steps.append(f"4. Aplicamos el Teorema Fundamental del Cálculo: \\( F({upper}) - F({lower}) \\)")
            steps.append(f"5. Resultado numérico final: \\( {sp.latex(result)} \\)")
        else:
            result = sp.integrate(f, x)
            steps.append(f"2. Calculamos la integral indefinida aplicando las reglas de integración correspondientes.")
            steps.append(f"3. Obtenemos la familia de antiderivadas (no olvidemos la constante C): \\( {sp.latex(result)} + C \\)")
            
        range_parts = graph_range_str.split(',')
        if len(range_parts) == 2:
            x_min, x_max = float(range_parts[0]), float(range_parts[1])
        else:
            x_min, x_max = -10, 10
            
        if is_definite:
            # Asegurarse de que el rango de la gráfica incluya los límites de integración si es posible
            if lower < x_min: x_min = lower - 1
            if upper > x_max: x_max = upper + 1
            
        x_vals = np.linspace(x_min, x_max, 400)
        f_lam = sp.lambdify(x, f, modules=['numpy', 'sympy'])
        
        y_vals = []
        for xv in x_vals:
            try:
                yv = float(f_lam(xv))
                if np.isnan(yv) or np.isinf(yv) or np.iscomplex(yv):
                    y_vals.append(None)
                else:
                    y_vals.append(yv)
            except Exception:
                y_vals.append(None)
                
        area_x = []
        area_y = []
        if is_definite:
            # Puntos adicionales para el área sombreada y mayor resolución
            a_vals = np.linspace(lower, upper, 150)
            for av in a_vals:
                try:
                    yv = float(f_lam(av))
                    if not (np.isnan(yv) or np.isinf(yv) or np.iscomplex(yv)):
                        area_x.append(av)
                        area_y.append(yv)
                except Exception:
                    pass

        response = {
            'success': True,
            'result_latex': sp.latex(result) + (' + C' if not is_definite else ''),
            'steps': steps,
            'graph': {
                'x': x_vals.tolist(),
                'y': y_vals,
            }
        }
        if is_definite:
            # Agregamos los datos del área a la respuesta para el frontend
            response['graph']['area_x'] = area_x
            response['graph']['area_y'] = area_y
            
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error al procesar la función matemática. Revisa la sintaxis o si faltan operaciones (ej. usar 2*x en vez de 2x). Detalles técnicos: {str(e)}"
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
