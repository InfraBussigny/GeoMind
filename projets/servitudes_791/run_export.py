"""
Export PDF via subprocess - Plan de situation BF 791
"""
import subprocess
import os

QGIS_PROCESS = r"C:\Program Files\QGIS 3.40.4\bin\qgis_process-qgis-ltr.bat"
PROJECT = r"C:\Users\zema\GeoBrain\projets\servitudes_791\servitudes_791.qgs"
LAYOUT = "Plan de situation A4 paysage"
OUTPUT = r"C:\Users\zema\GeoBrain\projets\servitudes_791\Plan_servitudes_BF791_Bussigny.pdf"

cmd = [
    QGIS_PROCESS,
    "run", "native:printlayouttopdf",
    f"--PROJECT_PATH={PROJECT}",
    f"--LAYOUT={LAYOUT}",
    "--DPI=300",
    "--FORCE_VECTOR=true",
    "--GEOREFERENCE=true",
    f"--OUTPUT={OUTPUT}"
]

print("Executing:", " ".join(cmd))
print()

result = subprocess.run(cmd, capture_output=True, text=True, shell=True)

print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)

if os.path.exists(OUTPUT):
    print(f"\nSUCCES! PDF cree: {OUTPUT}")
    os.startfile(OUTPUT)
else:
    print("\nECHEC - PDF non cree")
