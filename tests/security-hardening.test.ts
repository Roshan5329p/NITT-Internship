import { describe, expect, it } from 'vitest';
import {
  formatSafeCsvCell,
  MAX_LAB_CSV_FILE_BYTES,
  MAX_LAB_CSV_ROWS,
  parseLabCouponsCsv,
  sanitizeExternalHttpUrl
} from '../src/components/LabCalibrationPanel';

describe('Security Hardening Regressions', () => {
  it('sanitizeExternalHttpUrl blocks dangerous protocols and accepts valid http/https links', () => {
    expect(sanitizeExternalHttpUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeExternalHttpUrl('  JAVASCRIPT:alert(document.cookie)  ')).toBe('');
    expect(sanitizeExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeExternalHttpUrl('vbscript:msgbox(1)')).toBe('');
    expect(sanitizeExternalHttpUrl('file:///C:/Windows/win.ini')).toBe('');
    expect(sanitizeExternalHttpUrl('not a url')).toBe('');
    expect(sanitizeExternalHttpUrl('https://iris.unitn.it/bitstream/11572/187253/5/RevisedManuscript.pdf')).toBe(
      'https://iris.unitn.it/bitstream/11572/187253/5/RevisedManuscript.pdf'
    );
    expect(sanitizeExternalHttpUrl('http://example.org/paper.pdf')).toBe('http://example.org/paper.pdf');
  });

  it('formatSafeCsvCell neutralizes CSV formula injection while preserving numbers and escaping quotes', () => {
    expect(formatSafeCsvCell('=CMD|"/C calc"!A0')).toBe('"\'=CMD|""/C calc""!A0"');
    expect(formatSafeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(formatSafeCsvCell('-1+1')).toBe('"\'-1+1"');
    expect(formatSafeCsvCell('@SUM(A1:A5)')).toBe('"\'@SUM(A1:A5)"');
    expect(formatSafeCsvCell('\t=HYPERLINK("http://evil")')).toBe('"\'\t=HYPERLINK(""http://evil"")"');
    expect(formatSafeCsvCell('  =1+1')).toBe('"\'  =1+1"');
    expect(formatSafeCsvCell(-6.2)).toBe('-6.2');
    expect(formatSafeCsvCell('-6.2')).toBe('"-6.2"');
    expect(formatSafeCsvCell('Smith "Co-Author", J.')).toBe('"Smith ""Co-Author"", J."');
    expect(formatSafeCsvCell(null)).toBe('""');
  });

  it('parseLabCouponsCsv rejects files larger than 2 MB and CSVs with > 5000 rows', () => {
    const sampleRow = 'NITT-01,lpbf,280,960,110,40,200,HIP,342,912,996,14.8';
    const oversizedSizeResult = parseLabCouponsCsv(
      'sample_id,process,P_W,v_mm_s,h_um,t_um,T0_C,post_proc,measured_HV\n' + sampleRow,
      MAX_LAB_CSV_FILE_BYTES + 1
    );
    expect(oversizedSizeResult.validCount).toBe(0);
    expect(oversizedSizeResult.errors[0].reason).toContain('2 MB');

    const header = 'sample_id,process,P_W,v_mm_s,h_um,t_um,T0_C,post_proc,measured_HV';
    const manyRows = [header];
    for (let i = 0; i <= MAX_LAB_CSV_ROWS; i++) {
      manyRows.push(`NITT-${i},lpbf,280,960,110,40,200,HIP,342`);
    }
    const rowLimitResult = parseLabCouponsCsv(manyRows.join('\n'));
    expect(rowLimitResult.validCount).toBe(0);
    expect(rowLimitResult.errors[0].reason).toContain('5,000');
  });
});
