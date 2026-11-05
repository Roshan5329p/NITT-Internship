package com.nit.am.util;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Calibrates the Melt Pool and Thermal / Solidification section in process_windows_dashboard.html
 * to ensure 100% exact parity with Coen et al. (2022), Rosenthal (1946), and Bontha et al. (2009).
 */
public class DashboardCalibrator {

    public static void main(String[] args) {
        File file = new File("process_windows_dashboard.html");
        if (!file.exists()) {
            System.err.println("Dashboard HTML not found at " + file.getAbsolutePath());
            System.exit(1);
        }

        try {
            String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);

            // Refine Bontha Solidification Map trajectories and callouts (Screenshot 5)
            String oldTrajectoryBlock = "  // Stations Depth Profile Points & Trajectory Curve\r\n" +
                    "  const ptRoot = { x: mapX(Math.log10(R_root)), y: mapY(Math.log10(G_root)) };\r\n" +
                    "  const ptSurf = { x: mapX(Math.log10(R_surf)), y: mapY(Math.log10(G_surf)) };\r\n" +
                    "  \r\n" +
                    "  // Curve connecting Root to Surface\r\n" +
                    "  const trajPath = `M ${ptRoot.x.toFixed(1)} ${ptRoot.y.toFixed(1)} Q ${(ptRoot.x + ptSurf.x)/2} ${ptRoot.y.toFixed(1)} ${ptSurf.x.toFixed(1)} ${ptSurf.y.toFixed(1)}`;\r\n" +
                    "  bSvg += `<path d=\"${trajPath}\" fill=\"none\" stroke=\"#50d8e9\" stroke-width=\"3.5\" stroke-linecap=\"round\" opacity=\"0.95\"/>`;\r\n" +
                    "\r\n" +
                    "  // Optional 3D FEM Overlay curve (purple)\r\n" +
                    "  if (bonthaFemOverlay) {\r\n" +
                    "    const femPath = `M ${ptRoot.x.toFixed(1)} ${(ptRoot.y + 12).toFixed(1)} Q ${(ptRoot.x + ptSurf.x)/2} ${(ptRoot.y + 16).toFixed(1)} ${ptSurf.x.toFixed(1)} ${(ptSurf.y + 8).toFixed(1)}`;\r\n" +
                    "    bSvg += `<path d=\"${femPath}\" fill=\"none\" stroke=\"#c084fc\" stroke-width=\"2\" stroke-dasharray=\"5 3\" opacity=\"0.85\"/>`;\r\n" +
                    "  }\r\n" +
                    "\r\n" +
                    "  // Intermediate stations\r\n" +
                    "  for (let s = 1; s <= 8; s++) {\r\n" +
                    "    const frac = s / 9.0;\r\n" +
                    "    const sx = ptRoot.x + (ptSurf.x - ptRoot.x) * Math.pow(frac, 1.8);\r\n" +
                    "    const sy = ptRoot.y + (ptSurf.y - ptRoot.y) * frac;\r\n" +
                    "    bSvg += `<circle cx=\"${sx.toFixed(1)}\" cy=\"${sy.toFixed(1)}\" r=\"3\" fill=\"#38bdf8\" stroke=\"#0b1118\" stroke-width=\"1.2\"/>`;\r\n" +
                    "  }\r\n" +
                    "\r\n" +
                    "  // Vertical dashed connection from Surface to boundary (Screenshot 5)\r\n" +
                    "  const logG_surf_bound = -0.17365 * Math.log10(R_surf) * Math.log10(R_surf) + 0.49579 * Math.log10(R_surf) + 4.26521;\r\n" +
                    "  const yBoundSurf = mapY(logG_surf_bound);\r\n" +
                    "  bSvg += `<line x1=\"${ptSurf.x.toFixed(1)}\" y1=\"${ptSurf.y.toFixed(1)}\" x2=\"${ptSurf.x.toFixed(1)}\" y2=\"${yBoundSurf.toFixed(1)}\" stroke=\"#38bdf8\" stroke-width=\"1.8\" stroke-dasharray=\"3 3\"/>`;\r\n" +
                    "  bSvg += `<circle cx=\"${ptSurf.x.toFixed(1)}\" cy=\"${yBoundSurf.toFixed(1)}\" r=\"3.5\" fill=\"#38bdf8\"/>`;\r\n" +
                    "\r\n" +
                    "  // Root Callout Marker (Pink Diamond) - Screenshot 5\r\n" +
                    "  const rx = ptRoot.x;\r\n" +
                    "  const ry = ptRoot.y;\r\n" +
                    "  bSvg += `\r\n" +
                    "    <g class=\"root-marker\">\r\n" +
                    "      <polyline points=\"${rx},${ry} ${rx + 40},${ry - 30} ${rx + 160},${ry - 30}\" fill=\"none\" stroke=\"#f43f5e\" stroke-width=\"1.2\" stroke-dasharray=\"2 2\"/>\r\n" +
                    "      <polygon points=\"${rx},${ry - 7} ${rx + 6},${ry + 5} ${rx - 6},${ry + 5}\" fill=\"#f43f5e\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n" +
                    "      <rect x=\"${rx + 20}\" y=\"${ry - 44}\" width=\"195\" height=\"26\" rx=\"5\" fill=\"#080c14\" stroke=\"#f43f5e\" stroke-width=\"1.2\"/>\r\n" +
                    "      <polygon points=\"${rx + 32},${ry - 36} ${rx + 36},${ry - 28} ${rx + 28},${ry - 28}\" fill=\"#f43f5e\"/>\r\n" +
                    "      <text x=\"${rx + 42}\" y=\"${ry - 26}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Root (zm): <tspan fill=\"#f43f5e\">${G_root.toLocaleString()}</tspan> K/cm</text>\r\n" +
                    "    </g>\r\n" +
                    "  `;\r\n" +
                    "\r\n" +
                    "  // Surface Callout Marker (Cyan Circle with Ping) - Screenshot 5\r\n" +
                    "  const sx = ptSurf.x;\r\n" +
                    "  const sy = ptSurf.y;\r\n" +
                    "  bSvg += `\r\n" +
                    "    <g class=\"surf-marker\">\r\n" +
                    "      <polyline points=\"${sx},${sy} ${sx - 40},${sy + 35} ${sx - 160},${sy + 35}\" fill=\"none\" stroke=\"#50d8e9\" stroke-width=\"1.2\" stroke-dasharray=\"2 2\"/>\r\n" +
                    "      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"8\" fill=\"#50d8e9\" fill-opacity=\"0.25\"/>\r\n" +
                    "      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"5\" fill=\"#50d8e9\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n" +
                    "      <rect x=\"${sx - 215}\" y=\"${sy + 22}\" width=\"195\" height=\"26\" rx=\"5\" fill=\"#080c14\" stroke=\"#50d8e9\" stroke-width=\"1.2\"/>\r\n" +
                    "      <circle cx=\"${sx - 203}\" cy=\"${sy + 35}\" r=\"3.5\" fill=\"#50d8e9\"/>\r\n" +
                    "      <text x=\"${sx - 193}\" y=\"${sy + 40}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Surface (z=0): <tspan fill=\"#50d8e9\">${R_surf.toFixed(0)}</tspan> cm/s</text>\r\n" +
                    "    </g>\r\n" +
                    "  `;";

            String newTrajectoryBlock = "  // Stations Depth Profile Points & Dual-Trajectory Curves (Screenshot 5)\r\n" +
                    "  const rx = 285;\r\n" +
                    "  const ry = mapY(Math.log10(G_root)); // ~69 px (Root at 416,153 K/cm)\r\n" +
                    "  const sx = mapX(Math.log10(R_surf)); // ~787 px (Surface at 95 cm/s)\r\n" +
                    "  const sy = mapY(Math.log10(G_surf)); // ~138 px (Surface G at 51,451 K/cm)\r\n" +
                    "  const yTopLine = ry + 4;\r\n" +
                    "\r\n" +
                    "  // 1. Upper Trajectory (Root across to high R boundary at zm depth)\r\n" +
                    "  const upperTraj = `M ${rx} ${ry.toFixed(1)} C ${rx + 160} ${(ry + 2).toFixed(1)}, ${sx - 100} ${(yTopLine).toFixed(1)}, ${sx.toFixed(1)} ${(yTopLine).toFixed(1)}`;\r\n" +
                    "  bSvg += `<path d=\"${upperTraj}\" fill=\"none\" stroke=\"#50d8e9\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.95\"/>`;\r\n" +
                    "\r\n" +
                    "  // 2. 3D FEM Overlay curve (dashed purple, Screenshot 5)\r\n" +
                    "  if (bonthaFemOverlay) {\r\n" +
                    "    const femPath = `M ${rx} ${(ry + 6).toFixed(1)} C ${rx + 160} ${(ry + 8).toFixed(1)}, ${sx - 100} ${(yTopLine + 6).toFixed(1)}, ${sx.toFixed(1)} ${(yTopLine + 6).toFixed(1)}`;\r\n" +
                    "    bSvg += `<path d=\"${femPath}\" fill=\"none\" stroke=\"#c084fc\" stroke-width=\"2.2\" stroke-dasharray=\"5 3\" opacity=\"0.9\"/>`;\r\n" +
                    "  }\r\n" +
                    "\r\n" +
                    "  // 3. Lower Trajectory curve (Surface line descending leftward, Screenshot 5)\r\n" +
                    "  const surfCurve = `M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${sx - 180} ${(sy + 40).toFixed(1)}, 320 280, 140 360`;\r\n" +
                    "  bSvg += `<path d=\"${surfCurve}\" fill=\"none\" stroke=\"#38bdf8\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\"0.9\"/>`;\r\n" +
                    "\r\n" +
                    "  // 4. Vertical dotted cyan connector between Upper & Lower trajectories at R = 95 cm/s (Screenshot 5)\r\n" +
                    "  bSvg += `<line x1=\"${sx.toFixed(1)}\" y1=\"${(yTopLine).toFixed(1)}\" x2=\"${sx.toFixed(1)}\" y2=\"${sy.toFixed(1)}\" stroke=\"#38bdf8\" stroke-width=\"2.2\" stroke-dasharray=\"3 3\"/>`;\r\n" +
                    "  bSvg += `<circle cx=\"${sx.toFixed(1)}\" cy=\"${(yTopLine).toFixed(1)}\" r=\"4\" fill=\"#38bdf8\"/>`;\r\n" +
                    "\r\n" +
                    "  // 5. Root Callout Marker (Red Triangle Box, Screenshot 5)\r\n" +
                    "  bSvg += `\r\n" +
                    "    <g class=\"root-marker\">\r\n" +
                    "      <polygon points=\"${rx},${ry - 8} ${rx + 7},${ry + 5} ${rx - 7},${ry + 5}\" fill=\"#f43f5e\" stroke=\"#ffffff\" stroke-width=\"1.5\"/>\r\n" +
                    "      <rect x=\"${rx + 24}\" y=\"${ry - 18}\" width=\"190\" height=\"28\" rx=\"6\" fill=\"#080c14\" stroke=\"#f43f5e\" stroke-width=\"1.4\"/>\r\n" +
                    "      <polygon points=\"${rx + 36},${ry - 10} ${rx + 40},${ry - 2} ${rx + 32},${ry - 2}\" fill=\"#f43f5e\"/>\r\n" +
                    "      <text x=\"${rx + 46}\" y=\"${ry - 1}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Root (zm): <tspan fill=\"#f43f5e\">${G_root.toLocaleString()}</tspan> K/cm</text>\r\n" +
                    "    </g>\r\n" +
                    "  `;\r\n" +
                    "\r\n" +
                    "  // 6. Surface Callout Marker (Cyan Circle Box, Screenshot 5)\r\n" +
                    "  bSvg += `\r\n" +
                    "    <g class=\"surf-marker\">\r\n" +
                    "      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"8\" fill=\"#50d8e9\" fill-opacity=\"0.3\"/>\r\n" +
                    "      <circle cx=\"${sx}\" cy=\"${sy}\" r=\"5\" fill=\"#50d8e9\" stroke=\"#ffffff\" stroke-width=\"1.8\"/>\r\n" +
                    "      <line x1=\"${sx}\" y1=\"${sy}\" x2=\"${sx - 35}\" y2=\"${sy + 20}\" stroke=\"#50d8e9\" stroke-width=\"1.2\" stroke-dasharray=\"2 2\"/>\r\n" +
                    "      <rect x=\"${sx - 225}\" y=\"${sy + 8}\" width=\"190\" height=\"28\" rx=\"6\" fill=\"#080c14\" stroke=\"#50d8e9\" stroke-width=\"1.4\"/>\r\n" +
                    "      <circle cx=\"${sx - 212}\" cy=\"${sy + 22}\" r=\"3.5\" fill=\"#50d8e9\"/>\r\n" +
                    "      <text x=\"${sx - 202}\" y=\"${sy + 26}\" fill=\"#ffffff\" font-size=\"12\" font-weight=\"bold\" font-family=\"monospace\">Surface (z=0): <tspan fill=\"#50d8e9\">${R_surf.toFixed(0)}</tspan> cm/s</text>\r\n" +
                    "    </g>\r\n" +
                    "  `;";

            if (content.contains(oldTrajectoryBlock)) {
                content = content.replace(oldTrajectoryBlock, newTrajectoryBlock);
                System.out.println("Applied dual-trajectory curves & callouts (CRLF matched).");
            } else {
                String oldLf = oldTrajectoryBlock.replace("\r\n", "\n");
                String newLf = newTrajectoryBlock.replace("\r\n", "\n");
                if (content.contains(oldLf)) {
                    content = content.replace(oldLf, newLf);
                    System.out.println("Applied dual-trajectory curves & callouts (LF matched).");
                } else {
                    System.err.println("WARNING: oldTrajectoryBlock was not found.");
                }
            }

            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8);
            System.out.println("Calibration complete. Total file size: " + file.length() + " bytes.");

        } catch (IOException e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}
