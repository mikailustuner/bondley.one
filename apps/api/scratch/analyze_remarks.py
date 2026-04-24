import xlrd
import re

def analyze_remarks(file_path):
    wb = xlrd.open_workbook(file_path)
    sh = wb.sheet_by_index(0)
    
    COL_ISIN = 1
    COL_SPREAD = 20
    COL_REMARKS = 30
    
    findings = []
    
    for row_idx in range(1, sh.nrows):
        isin = str(sh.cell_value(row_idx, COL_ISIN)).strip()
        spread = sh.cell_value(row_idx, COL_SPREAD)
        remarks = str(sh.cell_value(row_idx, COL_REMARKS)).strip()
        
        # Check if spread is empty/zero and remarks has something interesting
        if (not spread or spread == 0) and remarks:
            if any(keyword in remarks.lower() for keyword in ["tlref", "+", "baz", "bp", "%", "getiri"]):
                findings.append((isin, remarks))
                
    # Print unique remarks to see patterns
    unique_remarks = sorted(list(set([f[1] for f in findings])))
    print(f"Found {len(unique_remarks)} unique interesting remarks patterns:")
    for r in unique_remarks:
        print(f"- {r}")

if __name__ == "__main__":
    analyze_remarks("/home/f0x017/Desktop/FinCalc/tbliste_20260421.xls")
