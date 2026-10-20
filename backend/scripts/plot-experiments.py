"""Render measured solver histories. Run after experiment:vrp and experiment:curves.
Dependency: python -m pip install matplotlib
"""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'demo/algorithm-experiment/curves.json').read_text(encoding='utf-8'))
out = root.parent / 'docs/figures'
out.mkdir(parents=True, exist_ok=True)
fig, axes = plt.subplots(1, 2, figsize=(11, 4), layout='constrained')
for ax, item in zip(axes, data['histories']):
    history = item['history']
    ax.plot([x['generation'] for x in history], [x['score'] for x in history])
    ax.set_title(item['algorithm'])
    ax.set_xlabel('Generation')
    ax.set_ylabel('Distance (m)' if item['algorithm'] == 'CVRP-GA' else 'Distance + 1000 x late minutes')
    ax.grid(alpha=.25)
fig.suptitle('Measured best-of-generation history | 20-tight | seed 42')
fig.savefig(out / 'convergence.png', dpi=160)
plt.close(fig)
front = data['front']
fig, ax = plt.subplots(figsize=(7, 4.5), layout='constrained')
vehicles = sorted(set(x['vehicles'] for x in front))
for count in vehicles:
    subset = [x for x in front if x['vehicles'] == count]
    ax.scatter([x['distance'] / 1000 for x in subset], [x['late'] for x in subset], label=f'{count} vehicles')
ax.set(xlabel='Distance (km)', ylabel='Total late minutes', title='Approximate search front | 20-tight | seed 42')
ax.legend()
ax.grid(alpha=.25)
fig.savefig(out / 'pareto.png', dpi=160)
plt.close(fig)
print(f'Saved measured figures: {out}')
