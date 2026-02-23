import sympy as sp
from sympy.integrals.manualintegrate import integral_steps

def print_rule_tree(rule, indent=0):
    if not rule:
         return
    print(" " * indent + type(rule).__name__ + ": " + str(rule.context if hasattr(rule, 'context') else getattr(rule, 'integrand', '')))
    if hasattr(rule, 'substeps'):
         for s in rule.substeps:
             print_rule_tree(s, indent + 2)
    elif hasattr(rule, 'substep'):
         print_rule_tree(rule.substep, indent + 2)

x = sp.Symbol('x')
print_rule_tree(integral_steps(6*x**2 + sp.sin(x), x))
print("\n---")
print_rule_tree(integral_steps(x * sp.exp(x), x))
