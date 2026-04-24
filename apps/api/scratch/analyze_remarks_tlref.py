import xlrd
import re

def analyze_remarks(file_path):
    wb = xlrd.open_workbook(file_path)
    sh = wb.sheet_by_index(0)
    
    COL_ISIN = 1
    COL_REMARKS = 30
    
    unique_remarks = set()
    
    for row_idx in range(1, sh.nrows):
        remarks = str(sh.cell_value(row_idx, COL_REMARKS)).strip()
        if "tlref" in remarks.lower() or "baz" in remarks.lower() or "bp" in remarks.lower():
            unique_remarks.add(remarks)
                
    sorted_remarks = sorted(list(unique_remarks))
    print(f"Found {len(sorted_remarks)} unique TLREF/BP remarks patterns:")
    for r in sorted_remarks:
        print(f"- {r}")

if __name__ == "__main__":
    analyze_remarks("/home/f0x017/Desktop/FinCalc/tbliste_20260421.xls")
