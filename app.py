from flask import Flask, request, jsonify, render_template
import sympy as sp
from sympy.integrals.manualintegrate import integral_steps
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
        
        # Limpieza de entrada estándar
        func_str_clean = func_str.replace('^', '**')
        # Limpieza adicional por si mandan ln
        func_str_clean = func_str_clean.replace('ln(', 'log(')
        
        f = sp.sympify(func_str_clean)
        
        steps = []
        steps.append(f"1. Identificamos la función a integrar: \\( f(x) = {sp.latex(f)} \\)")
        
        # Obtener antiderivada y pasos reales
        indefinite_integral = sp.integrate(f, x)
        rule_tree = integral_steps(f, x)
        
        def format_step(rule, step_num=1):
            if not rule:
                return [], step_num
            
            steps_list = []
            cls_name = type(rule).__name__
            context = getattr(rule, 'context', getattr(rule, 'integrand', ''))
            
            if cls_name == 'ConstantTimesRule':
                steps_list.append(f"{step_num}. Sacamos la constante \\( {sp.latex(rule.constant)} \\): \\( {sp.latex(rule.constant)} \\int {sp.latex(rule.other)} \\, dx \\)")
                sub_steps, step_num = format_step(getattr(rule, 'substep', None), step_num + 1)
                steps_list.extend(sub_steps)
            elif cls_name == 'AddRule':
                steps_list.append(f"{step_num}. Aplicamos la regla de la suma, integrando cada término por separado.")
                step_num += 1
                for sub in getattr(rule, 'substeps', []):
                    sub_steps, step_num = format_step(sub, step_num)
                    steps_list.extend(sub_steps)
            elif cls_name == 'PowerRule':
                steps_list.append(f"{step_num}. Aplicamos la regla de la potencia para \\( {sp.latex(context)} \\).")
                step_num += 1
            elif cls_name == 'URule':
                steps_list.append(f"{step_num}. Sustitución \\( u = {sp.latex(rule.u_var)} \\), \\( du = {sp.latex(rule.u_derivative)} \\, dx \\).")
                sub_steps, step_num = format_step(getattr(rule, 'substep', None), step_num + 1)
                steps_list.extend(sub_steps)
            elif cls_name == 'PartsRule':
                steps_list.append(f"{step_num}. Integración por partes: \\( u = {sp.latex(rule.u)} \\), \\( dv = {sp.latex(rule.dv)} \\, dx \\).")
                sub_steps, step_num = format_step(getattr(rule, 'substep', None), step_num + 1)
                steps_list.extend(sub_steps)
            elif 'Trig' in cls_name or 'Sin' in cls_name or 'Cos' in cls_name:
                steps_list.append(f"{step_num}. Aplicamos integral trigonométrica para \\( {sp.latex(context)} \\).")
                step_num += 1
            elif cls_name == 'ExpRule':
                steps_list.append(f"{step_num}. Integral de la función exponencial: \\( e^x \\).")
                step_num += 1
            elif cls_name == 'ConstantRule':
                steps_list.append(f"{step_num}. Integral de una constante \\( {sp.latex(rule.constant)} \\) es \\( {sp.latex(rule.constant)}x \\).")
                step_num += 1
            else:
                steps_list.append(f"{step_num}. Integramos la expresión \\( {sp.latex(context)} \\).")
                if hasattr(rule, 'substep'):
                    sub_steps, step_num = format_step(rule.substep, step_num + 1)
                    steps_list.extend(sub_steps)
                elif hasattr(rule, 'substeps'):
                    step_num += 1
                    for sub in rule.substeps:
                        sub_steps, step_num = format_step(sub, step_num)
                        steps_list.extend(sub_steps)
                else:
                    step_num += 1
                    
            return steps_list, step_num
        
        if is_definite:
            lower = float(sp.sympify(str(lower_limit_str).replace('^', '**').replace('ln(', 'log(')))
            upper = float(sp.sympify(str(upper_limit_str).replace('^', '**').replace('ln(', 'log(')))
            
            steps.append(f"2. Evaluamos los límites de integración: de \\( a = {lower} \\) a \\( b = {upper} \\).")
            
            parsed_steps, next_step_num = format_step(rule_tree, 3)
            steps.extend(parsed_steps)
            steps.append(f"{next_step_num}. Antiderivada obtenida: \\( F(x) = {sp.latex(indefinite_integral)} \\)")
            
            result = sp.integrate(f, (x, lower, upper))
            steps.append(f"{next_step_num + 1}. Aplicamos el Teorema Fundamental del Cálculo: \\( F({upper}) - F({lower}) \\)")
            steps.append(f"{next_step_num + 2}. Resultado numérico final: \\( {sp.latex(result)} \\)")
        else:
            result = indefinite_integral
            parsed_steps, next_step_num = format_step(rule_tree, 2)
            steps.extend(parsed_steps)
            steps.append(f"{next_step_num}. Obtenemos la familia de antiderivadas (no olvidemos la constante C): \\( {sp.latex(result)} + C \\)")
            
        range_parts = graph_range_str.split(',')
        if len(range_parts) == 2:
            x_min, x_max = float(range_parts[0]), float(range_parts[1])
        else:
            x_min, x_max = -10, 10
            
        if is_definite:
            if lower < x_min: x_min = lower - 1
            if upper > x_max: x_max = upper + 1
            
        x_vals = np.linspace(x_min, x_max, 400)
        f_lam = sp.lambdify(x, f, modules=['numpy', 'sympy'])
        F_lam = sp.lambdify(x, indefinite_integral, modules=['numpy', 'sympy'])
        
        y_vals = []
        y_vals_int = []
        for xv in x_vals:
            try:
                yv = float(f_lam(xv))
                if np.isnan(yv) or np.isinf(yv) or np.iscomplex(yv):
                    y_vals.append(None)
                else:
                    y_vals.append(yv)
            except Exception:
                y_vals.append(None)
                
            try:
                yv_int = float(F_lam(xv))
                if np.isnan(yv_int) or np.isinf(yv_int) or np.iscomplex(yv_int):
                    y_vals_int.append(None)
                else:
                    y_vals_int.append(yv_int)
            except Exception:
                y_vals_int.append(None)
                
        area_x = []
        area_y = []
        if is_definite:
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
                'y_int': y_vals_int
            }
        }
        if is_definite:
            response['graph']['area_x'] = area_x
            response['graph']['area_y'] = area_y
            
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f"Error al procesar la función matemática. Revisa la sintaxis. Detalles técnicos: {str(e)}"
        })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
