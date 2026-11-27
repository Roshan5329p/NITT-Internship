#!/usr/bin/env python3
"""
Generates bold, high-contrast 1800x1200 (12x8 in @ 150 DPI) operational process
window figures for LPBF and DED/WAAM in both PNG and WebP formats.
"""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.lines import Line2D
import numpy as np
from PIL import Image


PLOTS_DIR = Path(__file__).resolve().parent.parent / 'plots'
HALO = [pe.withStroke(linewidth=4.0, foreground='#ffffff', alpha=0.96)]


def _save_png_and_webp(fig: plt.Figure, stem: str) -> None:
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    png_path = PLOTS_DIR / f'{stem}.png'
    webp_path = PLOTS_DIR / f'{stem}.webp'
    fig.savefig(png_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close(fig)
    with Image.open(png_path) as im:
        im.convert('RGB').save(webp_path, 'WEBP', quality=92, method=6)
    print(f'Generated {png_path.name} and {webp_path.name}')


def _style_axis(ax: plt.Axes, xlabel: str, ylabel: str) -> None:
    ax.set_facecolor('#ffffff')
    ax.grid(True, which='major', color='#cbd5e1', linestyle='-', linewidth=0.9, alpha=0.75, zorder=0)
    for spine in ax.spines.values():
        spine.set_color('#475569')
        spine.set_linewidth(1.5)
    ax.tick_params(axis='both', which='major', labelsize=13.5, colors='#0f172a', width=1.5, length=6)
    for tick in ax.get_xticklabels() + ax.get_yticklabels():
        tick.set_fontweight('bold')
    ax.set_xlabel(xlabel, fontsize=16, fontweight='bold', color='#0f172a', labelpad=10)
    ax.set_ylabel(ylabel, fontsize=16, fontweight='bold', color='#0f172a', labelpad=10)


def generate_lpbf_map() -> None:
    fig, ax = plt.subplots(figsize=(12, 8), dpi=150)
    fig.patch.set_facecolor('#ffffff')

    v_grid = np.linspace(400, 1800, 400)
    p_kh = 0.255 * v_grid      # Ev = 85 J/mm^3 (h = 100 um, t = 30 um -> 0.003 mm^2)
    p_mid = 0.210 * v_grid     # Ev = 70 J/mm^3
    p_lof = 0.165 * v_grid     # Ev = 55 J/mm^3

    # Shaded process zones
    v_cond = v_grid[v_grid <= 1500]
    ax.fill_between(v_cond, 0.165 * v_cond, 0.255 * v_cond, color='#bbf7d0', alpha=0.52, zorder=1)
    ax.fill_between(v_grid, 80, np.minimum(450, p_lof), color='#fecaca', alpha=0.45, zorder=1)
    v_ball = v_grid[v_grid >= 1500]
    ax.fill_between(v_ball, 80, np.minimum(0.165 * v_ball, 240), color='#fde68a', alpha=0.55, zorder=1)

    # Iso-VED lines
    ax.plot(v_grid, p_kh, color='#6d28d9', linestyle=(0, (5, 4)), linewidth=2.2, zorder=2)
    ax.plot(v_grid, p_mid, color='#14532d', linestyle=(0, (5, 4)), linewidth=2.0, zorder=2)
    ax.plot(v_grid, p_lof, color='#b91c1c', linestyle=(0, (5, 4)), linewidth=2.2, zorder=2)

    # Contour annotations placed cleanly away from scatter dots
    ax.text(1540, 412, 'Ev = 85 J/mm³', fontsize=12.5, fontweight='bold', color='#5b21b6',
            rotation=28, path_effects=HALO, zorder=5)
    ax.text(1540, 344, 'Ev = 70 J/mm³', fontsize=12.5, fontweight='bold', color='#14532d',
            rotation=24, path_effects=HALO, zorder=5)
    ax.text(1540, 272, 'Ev = 55 J/mm³', fontsize=12.5, fontweight='bold', color='#b91c1c',
            rotation=19, path_effects=HALO, zorder=5)

    # Experimental literature points
    green_pts = np.array([[800, 200], [900, 200], [1100, 250], [1150, 275], [1200, 280]])
    blue_pts = np.array([[800, 300], [900, 175], [950, 180], [1000, 250], [1050, 225], [1050, 250], [1200, 280], [1300, 300]])
    red_pts = np.array([[1250, 280]])

    ax.scatter(blue_pts[:, 0], blue_pts[:, 1], s=140, color='#2563eb', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(blue_pts[:, 0], blue_pts[:, 1], s=230, facecolors='none', edgecolors='#93c5fd', linewidths=1.5, zorder=3)
    ax.scatter(green_pts[:, 0], green_pts[:, 1], s=155, color='#047857', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(green_pts[:, 0], green_pts[:, 1], s=250, facecolors='none', edgecolors='#34d399', linewidths=1.6, zorder=3)
    ax.scatter(red_pts[:, 0], red_pts[:, 1], s=155, color='#dc2626', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(red_pts[:, 0], red_pts[:, 1], s=250, facecolors='none', edgecolors='#fca5a5', linewidths=1.6, zorder=3)

    # Extra-bold high-contrast regime titles (zero collisions with dots, lines, or legend)
    ax.text(1170, 412, 'KEYHOLING REGIME', fontsize=15, fontweight='bold', color='#5b21b6',
            ha='center', path_effects=HALO, zorder=5)
    ax.text(1390, 263, 'OPTIMAL CONDUCTION\nZONE', fontsize=12.5, fontweight='bold', color='#065f46',
            ha='center', va='center', path_effects=HALO, zorder=5)
    ax.text(1390, 241, '(Rel. Density > 99.8%)', fontsize=10.5, fontweight='bold', color='#047857',
            ha='center', path_effects=HALO, zorder=5)
    ax.text(1655, 220, 'BALLING REGIME', fontsize=14, fontweight='bold', color='#92400e',
            ha='center', path_effects=HALO, zorder=5)
    ax.text(1360, 142, 'LACK OF FUSION (LOF)', fontsize=14.5, fontweight='bold', color='#991b1b',
            ha='center', path_effects=HALO, zorder=5)

    legend_handles = [
        Line2D([0], [0], marker='o', color='w', label='ASTM F2924 Compliant / HIP / Annealed',
               markerfacecolor='#047857', markeredgecolor='#064e3b', markersize=9.5),
        Line2D([0], [0], marker='o', color='w', label='As-Built Conduction Melt (Standard)',
               markerfacecolor='#2563eb', markeredgecolor='#1e3a8a', markersize=9.5),
        Line2D([0], [0], marker='o', color='w', label='LOF / Boundary Condition Study',
               markerfacecolor='#dc2626', markeredgecolor='#7f1d1d', markersize=9.5),
        Line2D([0], [0], color='#334155', linestyle='--', linewidth=2.2, label='Isocline Energy Density (Ev) Contours'),
    ]
    leg = ax.legend(handles=legend_handles, loc='upper left', bbox_to_anchor=(0.015, 0.98),
                    title='LEGEND & METALLURGICAL KEY', frameon=True, framealpha=0.96,
                    edgecolor='#334155', facecolor='#ffffff', fontsize=11, title_fontsize=11.5)
    leg.get_frame().set_linewidth(1.4)
    leg.get_title().set_fontweight('bold')
    leg.get_title().set_color('#0f172a')
    for txt in leg.get_texts():
        txt.set_fontweight('bold')
        txt.set_color('#0f172a')

    ax.set_xlim(400, 1800)
    ax.set_ylim(100, 450)
    ax.set_xticks(np.arange(400, 1801, 200))
    ax.set_yticks(np.arange(100, 451, 50))
    _style_axis(ax, 'Scan Speed, v (mm/s)', 'Laser Power, P (W)')

    fig.text(0.075, 0.945, 'Ti-6Al-4V Laser Powder Bed Fusion (LPBF): Process Map & Defect Windows',
             fontsize=17.5, fontweight='bold', color='#0f172a')
    fig.text(0.075, 0.910, 'Laser Power (P) vs Scan Speed (v) showing Lack-of-Fusion, Keyholing, Balling & Safe Conduction Regimes (h = 100 µm, t = 30 µm)',
             fontsize=10.3, fontweight='bold', color='#334155')

    fig.subplots_adjust(left=0.075, right=0.975, top=0.88, bottom=0.10)
    _save_png_and_webp(fig, 'ti64_lpbf_defect_processing_window')


def generate_ded_waam_map() -> None:
    fig, ax = plt.subplots(figsize=(12, 8), dpi=150)
    fig.patch.set_facecolor('#ffffff')

    v_grid = np.linspace(5, 25, 400)
    p_hi220 = 220.0 * v_grid
    p_hi150 = 150.0 * v_grid
    p_hi80 = 80.0 * v_grid

    ax.fill_between(v_grid, np.maximum(800, p_hi80), np.minimum(3600, p_hi220), color='#bbf7d0', alpha=0.52, zorder=1)
    ax.fill_between(v_grid, 750, np.minimum(3600, p_hi80), color='#fecaca', alpha=0.45, zorder=1)

    ax.plot(v_grid, p_hi220, color='#c2410c', linestyle=(0, (5, 4)), linewidth=2.2, zorder=2)
    ax.plot(v_grid, p_hi150, color='#14532d', linestyle=(0, (5, 4)), linewidth=2.0, zorder=2)
    ax.plot(v_grid, p_hi80, color='#b91c1c', linestyle=(0, (5, 4)), linewidth=2.2, zorder=2)

    ax.text(14.0, 3150, 'HI = 220 J/mm', fontsize=12, fontweight='bold', color='#9a3412',
            rotation=41, path_effects=HALO, zorder=5)
    ax.text(20.2, 3175, 'HI = 150 J/mm', fontsize=12.5, fontweight='bold', color='#14532d',
            rotation=31, path_effects=HALO, zorder=5)
    ax.text(20.6, 1790, 'HI = 80 J/mm', fontsize=12.5, fontweight='bold', color='#b91c1c',
            rotation=18, path_effects=HALO, zorder=5)

    purple_pts = np.array([[6.0, 1800], [10.0, 2400], [12.0, 2000], [12.5, 2500], [14.0, 2200], [16.7, 3200]])
    pink_pts = np.array([[15.0, 1200]])
    cyan_pts = np.array([[10.0, 1800], [15.0, 800]])

    ax.scatter(purple_pts[:, 0], purple_pts[:, 1], s=145, color='#7c3aed', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(purple_pts[:, 0], purple_pts[:, 1], s=240, facecolors='none', edgecolors='#c4b5fd', linewidths=1.5, zorder=3)
    ax.scatter(pink_pts[:, 0], pink_pts[:, 1], s=155, color='#db2777', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(pink_pts[:, 0], pink_pts[:, 1], s=250, facecolors='none', edgecolors='#f9a8d4', linewidths=1.6, zorder=3)
    ax.scatter(cyan_pts[:, 0], cyan_pts[:, 1], s=145, color='#0284c7', edgecolors='#ffffff', linewidths=2.2, zorder=4)
    ax.scatter(cyan_pts[:, 0], cyan_pts[:, 1], s=240, facecolors='none', edgecolors='#7dd3fc', linewidths=1.5, zorder=3)

    ax.text(7.7, 2580, 'EXCESSIVE HEAT ACCUMULATION\n& COARSENING', fontsize=13.5, fontweight='bold', color='#9a3412',
            ha='center', va='center', path_effects=HALO, zorder=5)
    ax.text(20.5, 2320, 'HIGH INTEGRITY DEPOSITION ZONE', fontsize=14.5, fontweight='bold', color='#065f46',
            ha='center', path_effects=HALO, zorder=5)
    ax.text(20.5, 2150, '(Balanced Heat Input: 80–220 J/mm)', fontsize=11.5, fontweight='bold', color='#047857',
            ha='center', path_effects=HALO, zorder=5)
    ax.text(20.5, 1180, 'INCOMPLETE SIDEWALL FUSION / LOF', fontsize=14, fontweight='bold', color='#991b1b',
            ha='center', path_effects=HALO, zorder=5)

    legend_handles = [
        Line2D([0], [0], marker='o', color='w', label='Wire-Laser DED (High Build Rate)',
               markerfacecolor='#7c3aed', markeredgecolor='#4c1d95', markersize=9.5),
        Line2D([0], [0], marker='o', color='w', label='Aerospace Component Repair (Groove/Blade)',
               markerfacecolor='#db2777', markeredgecolor='#831843', markersize=9.5),
        Line2D([0], [0], marker='o', color='w', label='Blown-Powder DED (Coaxial Cladding)',
               markerfacecolor='#0284c7', markeredgecolor='#0c4a6e', markersize=9.5),
        Line2D([0], [0], color='#334155', linestyle='--', linewidth=2.2, label='Linear Heat Input (HI) Contours'),
    ]
    leg = ax.legend(handles=legend_handles, loc='upper left', bbox_to_anchor=(0.015, 0.98),
                    title='LEGEND & METALLURGICAL KEY', frameon=True, framealpha=0.96,
                    edgecolor='#334155', facecolor='#ffffff', fontsize=11, title_fontsize=11.5)
    leg.get_frame().set_linewidth(1.4)
    leg.get_title().set_fontweight('bold')
    leg.get_title().set_color('#0f172a')
    for txt in leg.get_texts():
        txt.set_fontweight('bold')
        txt.set_color('#0f172a')

    ax.set_xlim(5, 25)
    ax.set_ylim(800, 3600)
    ax.set_xticks(np.arange(5, 26, 5))
    ax.set_yticks(np.arange(800, 3601, 400))
    _style_axis(ax, 'Travel Speed, v (mm/s)', 'Laser / Arc Power, P (W)')

    fig.text(0.085, 0.945, 'Ti-6Al-4V Directed Energy Deposition (DED / WAAM): Process & Defect Map',
             fontsize=17.5, fontweight='bold', color='#0f172a')
    fig.text(0.085, 0.910, 'Laser / Arc Power (W) vs Travel Speed (mm/s) mapping Linear Heat Input (J/mm), Grain Coarsening & LOF',
             fontsize=11.5, fontweight='bold', color='#334155')

    fig.subplots_adjust(left=0.085, right=0.975, top=0.88, bottom=0.10)
    _save_png_and_webp(fig, 'ti64_ded_waam_process_window')


if __name__ == '__main__':
    generate_lpbf_map()
    generate_ded_waam_map()
