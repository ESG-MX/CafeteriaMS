const express  = require('express');
const router   = express.Router();
const ExcelJS  = require('exceljs');
const db       = require('../db');
const { auth, scopeClient } = require('../middleware/auth');

// ── Paleta SDC ────────────────────────────────────────────────────
const NAVY   = '0C2340';
const ORANGE = 'FF9E1B';
const GRAY1  = 'F2F4F7';   // filas pares
const GRAY2  = 'FFFFFF';   // filas impares
const WHITE  = 'FFFFFF';
const LIGHT_ORANGE = 'FFF3E0';

function styleHeader(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Arial' };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
  cell.border = { bottom: { style: 'medium', color: { argb: ORANGE } } };
}

function styleTitle(cell, fontSize = 14) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.font = { bold: true, color: { argb: WHITE }, size: fontSize, name: 'Arial' };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function styleMeta(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ORANGE } };
  cell.font = { size: 9, name: 'Arial', color: { argb: NAVY } };
  cell.alignment = { vertical: 'middle' };
}

function styleMetaLabel(cell) {
  styleMeta(cell);
  cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NAVY } };
}

function styleData(cell, isEven) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? GRAY1 : GRAY2 } };
  cell.font = { size: 9, name: 'Arial' };
  cell.alignment = { vertical: 'middle' };
  cell.border = { bottom: { style: 'hair', color: { argb: 'DDDDDD' } } };
}

function styleTotal(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Arial' };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

function styleTotalAmount(cell) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
  cell.font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Arial' };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.numFmt = '"$"#,##0.00';
}

router.use(auth);

// ── Historial ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { from, to, service_type_id, employee_id } = req.query;
  const clientId = scopeClient(req);
  let q = `SELECT TOP 1000 p.*, COALESCE(p.client_name, c.name) as client_name FROM purchases p LEFT JOIN clients c ON p.client_id = c.id WHERE 1=1`;
  const params = [];
  if (clientId)       { q += ' AND p.client_id=?';        params.push(clientId); }
  if (from)           { q += ' AND CAST(p.created_at AS DATE) >= ?'; params.push(from); }
  if (to)             { q += ' AND CAST(p.created_at AS DATE) <= ?'; params.push(to); }
  if (service_type_id){ q += ' AND p.service_type_id=?';  params.push(service_type_id); }
  if (employee_id)    { q += ' AND p.employee_id=?';       params.push(employee_id); }
  q += ' ORDER BY p.created_at DESC';
  try {
    res.json(await db.allAsync(q, params));
  } catch (e) { console.error('[purchases]', e); res.status(500).json({ error: e?.message || String(e) }); }
});

// ── Reporte Desglosado ────────────────────────────────────────────
router.get('/report/detail', async (req, res) => {
  const { from, to, client_id: qClientId } = req.query;
  const clientId = scopeClient(req) ?? (qClientId ? Number(qClientId) : null);

  let q = `SELECT p.id, p.created_at, p.employee_number, p.employee_name,
              p.service_name, p.price, p.status, COALESCE(p.client_name, c.name) as client_name
           FROM purchases p LEFT JOIN clients c ON p.client_id=c.id
           WHERE p.status='approved'`;
  const params = [];
  if (clientId) { q += ' AND p.client_id=?'; params.push(clientId); }
  if (from)     { q += ' AND CAST(p.created_at AS DATE) >= ?'; params.push(from); }
  if (to)       { q += ' AND CAST(p.created_at AS DATE) <= ?'; params.push(to); }
  q += ' ORDER BY p.created_at';

  try {
    const rows = await db.allAsync(q, params);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CafeteriaMS';
    const ws = wb.addWorksheet('Detalle');

    const COLS = 9;

    // ── Fila 1: título ──
    ws.mergeCells(1, 1, 1, COLS);
    styleTitle(ws.getCell(1, 1));
    ws.getCell(1, 1).value = 'CafeteriaMS';
    ws.getRow(1).height = 32;

    // ── Fila 2: subtítulo ──
    ws.mergeCells(2, 1, 2, COLS);
    ws.getCell(2, 1).value = 'Reporte Desglosado de Transacciones';
    ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    ws.getCell(2, 1).font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Arial' };
    ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // ── Fila 3: metadatos ──
    const metaData = [
      ['Empresa:', clientId ? (rows[0]?.client_name || '—') : 'Todas', '',
       'Período:', (from || '—') + '  →  ' + (to || '—'), '',
       'Total registros:', rows.length, '']
    ];
    ws.addRow(metaData[0]);
    const metaRow = ws.getRow(3);
    metaRow.height = 20;
    [1, 4, 7].forEach(c => styleMetaLabel(ws.getCell(3, c)));
    [2, 5, 8].forEach(c => styleMeta(ws.getCell(3, c)));
    ws.mergeCells(3, 2, 3, 3);
    ws.mergeCells(3, 5, 3, 6);
    ws.mergeCells(3, 8, 3, 9);

    // ── Fila 4: vacía ──
    ws.addRow([]);
    ws.getRow(4).height = 6;

    // ── Fila 5: headers ──
    // Columnas: ID | Fecha | Empresa | No.Emp | Empleado | Servicio | Cantidad | Monto | Estado
    const headers = ['ID', 'Fecha / Hora', 'Empresa', 'No. Empleado', 'Empleado', 'Servicio', 'Cantidad', 'Monto', 'Estado'];
    ws.addRow(headers);
    const headerRow = ws.getRow(5);
    headerRow.height = 22;
    headers.forEach((_, i) => styleHeader(ws.getCell(5, i + 1)));

    // ── Filas de datos ──
    rows.forEach((r, idx) => {
      const isEven = idx % 2 === 0;
      const d = new Date(r.created_at);
      const fechaStr = isNaN(d) ? r.created_at : d.toLocaleString('es-MX', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      const dataRow = ws.addRow([
        r.id, fechaStr, r.client_name, r.employee_number,
        r.employee_name, r.service_name, 1, r.price, 'Aprobado'
      ]);
      dataRow.height = 18;
      dataRow.eachCell({ includeEmpty: true }, (cell, col) => {
        styleData(cell, isEven);
        if (col === 7) { cell.alignment.horizontal = 'center'; }
        if (col === 8) { cell.numFmt = '"$"#,##0.00'; cell.alignment.horizontal = 'right'; }
        if (col === 9) { cell.font = { ...cell.font, color: { argb: '1A7C3E' } }; cell.alignment.horizontal = 'center'; }
        if (col === 1) { cell.alignment.horizontal = 'center'; }
        if (col === 4) { cell.alignment.horizontal = 'center'; }
      });
    });

    // ── Fila total ──
    const sepRow = ws.addRow([]);
    sepRow.height = 6;
    const totalRow = ws.addRow(['', '', '', '', '', '', rows.length, 0, '']);
    const trn = totalRow.number;
    ws.mergeCells(trn, 1, trn, 6);
    styleTotal(ws.getCell(trn, 1));
    ws.getCell(trn, 1).value = 'TOTAL GENERAL';
    styleTotal(ws.getCell(trn, 7));
    ws.getCell(trn, 7).alignment = { horizontal: 'center', vertical: 'middle' };
    const dataStart = 6;
    const dataEnd   = trn - 2;
    ws.getCell(trn, 8).value = rows.length > 0 ? { formula: `SUM(H${dataStart}:H${dataEnd})` } : 0;
    styleTotalAmount(ws.getCell(trn, 8));
    ws.getCell(trn, 8).numFmt = '"$"#,##0.00';
    styleTotal(ws.getCell(trn, 9));
    ws.getCell(trn, 9).value = `${rows.length} cobros`;
    totalRow.height = 24;

    // ── Anchos de columna ──
    ws.columns = [
      { width: 7  },  // ID
      { width: 20 },  // Fecha
      { width: 18 },  // Empresa
      { width: 16 },  // No. Emp
      { width: 28 },  // Empleado
      { width: 16 },  // Servicio
      { width: 11 },  // Cantidad
      { width: 14 },  // Monto
      { width: 12 },  // Estado
    ];

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="reporte_detalle.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { console.error('[purchases]', e); res.status(500).json({ error: e?.message || String(e) }); }
});

// ── Reporte Cierre de Mes ─────────────────────────────────────────
router.get('/report/payroll', async (req, res) => {
  const { from, to, client_id: qClientId } = req.query;
  const clientId = scopeClient(req) ?? (qClientId ? Number(qClientId) : null);

  let q = `SELECT p.employee_number, p.employee_name, p.service_name,
              COUNT(*) as cantidad, SUM(p.price) as total, COALESCE(p.client_name, c.name) as client_name
           FROM purchases p LEFT JOIN clients c ON p.client_id=c.id
           WHERE p.status='approved'`;
  const params = [];
  if (clientId) { q += ' AND p.client_id=?'; params.push(clientId); }
  if (from)     { q += ' AND CAST(p.created_at AS DATE) >= ?'; params.push(from); }
  if (to)       { q += ' AND CAST(p.created_at AS DATE) <= ?'; params.push(to); }
  q += ' GROUP BY p.employee_number, p.employee_name, p.service_name, p.client_id, c.name ORDER BY c.name, p.employee_name, p.service_name';

  try {
    const rows = await db.allAsync(q, params);

    // Pre-calcular para usarlos en el encabezado del documento
    const grandQty   = rows.reduce((s, r) => s + Number(r.cantidad), 0);
    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const svcNames   = [...new Set(rows.map(r => r.service_name))].join(' / ') || '—';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CafeteriaMS';
    const ws = wb.addWorksheet('Cierre de Mes');

    const COLS = 6;

    const docBorder = {
      top:    { style: 'thin', color: { argb: 'BBBBBB' } },
      left:   { style: 'thin', color: { argb: 'BBBBBB' } },
      bottom: { style: 'thin', color: { argb: 'BBBBBB' } },
      right:  { style: 'thin', color: { argb: 'BBBBBB' } },
    };
    const applyDocStyle = (cell, bold = false) => {
      cell.font      = { name: 'Arial', size: 9, bold };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border    = docBorder;
    };

    // ── Fila 1: título ──
    ws.mergeCells(1, 1, 1, COLS);
    styleTitle(ws.getCell(1, 1));
    ws.getCell(1, 1).value = 'CafeteriaMS';
    ws.getRow(1).height = 32;

    // ── Fila 2: subtítulo ──
    ws.mergeCells(2, 1, 2, COLS);
    ws.getCell(2, 1).value = 'Reporte Cierre de Mes';
    ws.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    ws.getCell(2, 1).font = { bold: true, color: { argb: WHITE }, size: 11, name: 'Arial' };
    ws.getCell(2, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // ── Fila 3: metadatos SDC ──
    const metaRow = ws.addRow([
      'Empresa:', clientId ? (rows[0]?.client_name || '—') : 'Todas',
      'Período:', (from || '—') + '  →  ' + (to || '—'),
      'Empleados:', new Set(rows.map(r => r.employee_number)).size
    ]);
    metaRow.height = 20;
    [1, 3, 5].forEach(c => styleMetaLabel(ws.getCell(3, c)));
    [2, 4, 6].forEach(c => styleMeta(ws.getCell(3, c)));

    // ── Fila 4: vacía ──
    ws.addRow([]).height = 4;

    // ── Encabezado del documento (estilo referencia) ──────────────

    // Fila: ORDEN DE SUMINISTRO + NO. DE FOLIO
    const r5 = ws.addRow(['', '', '', '', 'NO. DE FOLIO:', '']);
    ws.mergeCells(r5.number, 1, r5.number, 4);
    ws.getCell(r5.number, 1).value = 'ORDEN DE SUMINISTRO (RACIONES PARA TRABAJADORES CON DERECHO A COMEDOR)';
    applyDocStyle(ws.getCell(r5.number, 1), true);
    applyDocStyle(ws.getCell(r5.number, 5), true);
    applyDocStyle(ws.getCell(r5.number, 6));
    ws.getCell(r5.number, 5).alignment = { horizontal: 'right', vertical: 'middle' };
    r5.height = 18;

    // Fila: FECHA INICIO / FECHA FIN
    const r6 = ws.addRow(['FECHA INICIO:', from || '', 'FECHA FIN:', to || '', '', '']);
    ws.mergeCells(r6.number, 5, r6.number, 6);
    [1,2,3,4,5].forEach(c => applyDocStyle(ws.getCell(r6.number, c), c % 2 !== 0));
    ws.getCell(r6.number, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(r6.number, 3).alignment = { horizontal: 'right', vertical: 'middle' };
    r6.height = 18;

    // Fila: SERVICIO SOLICITADO
    const r7 = ws.addRow(['SERVICIO SOLICITADO', '', '', '', '', '']);
    ws.mergeCells(r7.number, 2, r7.number, 6);
    ws.getCell(r7.number, 2).value = svcNames;
    applyDocStyle(ws.getCell(r7.number, 1), true);
    applyDocStyle(ws.getCell(r7.number, 2));
    r7.height = 18;

    // Fila: TOTAL DE DIETAS / HORARIO / HORA
    const r8 = ws.addRow(['TOTAL DE DIETAS', grandQty, 'HORARIO DE ENTREGA:', '', 'HORA DE RECIBIDO:', '']);
    ws.mergeCells(r8.number, 3, r8.number, 4);
    [1,2,3,5,6].forEach(c => applyDocStyle(ws.getCell(r8.number, c), [1,3,5].includes(c)));
    ws.getCell(r8.number, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    r8.height = 18;

    // Fila: SECCIÓN
    const r9 = ws.addRow(['SECCIÓN', '', '', '', '', '']);
    ws.mergeCells(r9.number, 2, r9.number, 6);
    applyDocStyle(ws.getCell(r9.number, 1), true);
    applyDocStyle(ws.getCell(r9.number, 2));
    r9.height = 18;

    // ── Separador ──
    ws.addRow([]).height = 4;

    // ── Headers de tabla ──
    const headers = ['Empresa', 'No. Empleado', 'Empleado', 'Servicio', 'Cantidad', 'Total'];
    const headerRow = ws.addRow(headers);
    headerRow.height = 22;
    headers.forEach((_, i) => styleHeader(ws.getCell(headerRow.number, i + 1)));

    // ── Agrupar por empleado ──
    const empGroups = {};
    rows.forEach(r => {
      const key = `${r.client_name}||${r.employee_number}`;
      if (!empGroups[key]) empGroups[key] = {
        client_name: r.client_name,
        employee_number: r.employee_number,
        employee_name: r.employee_name,
        services: []
      };
      empGroups[key].services.push(r);
    });

    // ── Filas de datos con subtotales ──
    Object.values(empGroups).forEach((emp, empIdx) => {
      const isEven = empIdx % 2 === 0;
      const firstDataRow = ws.rowCount + 1;

      emp.services.forEach((r, svcIdx) => {
        const row = ws.addRow([
          svcIdx === 0 ? r.client_name : '',
          svcIdx === 0 ? r.employee_number : '',
          svcIdx === 0 ? r.employee_name : '',
          r.service_name,
          Number(r.cantidad),
          Number(r.total),
        ]);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          styleData(cell, isEven);
          if (col === 5) { cell.alignment.horizontal = 'center'; }
          if (col === 6) { cell.numFmt = '"$"#,##0.00'; cell.alignment.horizontal = 'right'; }
        });
      });

      // Subtotal — sólo si tiene más de 1 servicio
      if (emp.services.length > 1) {
        const lastDataRow = ws.rowCount;
        const subRow = ws.addRow(['', '', '', '', '', '']);
        const rn = subRow.number;
        ws.mergeCells(rn, 1, rn, 4);
        ws.getCell(rn, 1).value = `Subtotal — ${emp.employee_name}`;
        ws.getCell(rn, 1).font  = { bold: true, size: 9, name: 'Arial', color: { argb: NAVY } };
        ws.getCell(rn, 1).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(rn, 1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EFF7' } };
        ws.getCell(rn, 5).value = { formula: `SUM(E${firstDataRow}:E${lastDataRow})` };
        ws.getCell(rn, 5).font  = { bold: true, size: 9, name: 'Arial' };
        ws.getCell(rn, 5).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EFF7' } };
        ws.getCell(rn, 5).alignment = { horizontal: 'center' };
        ws.getCell(rn, 6).value = { formula: `SUM(F${firstDataRow}:F${lastDataRow})` };
        ws.getCell(rn, 6).font  = { bold: true, size: 9, name: 'Arial', color: { argb: NAVY } };
        ws.getCell(rn, 6).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EFF7' } };
        ws.getCell(rn, 6).numFmt = '"$"#,##0.00';
        ws.getCell(rn, 6).alignment = { horizontal: 'right' };
        subRow.height = 18;
      }
    });

    // ── Separador ──
    const sep = ws.addRow([]);
    sep.height = 6;

    // ── Total general ──
    const totalRow = ws.addRow(['', '', '', '', grandQty, grandTotal]);
    const trn = totalRow.number;
    ws.mergeCells(trn, 1, trn, 4);
    styleTotal(ws.getCell(trn, 1));
    ws.getCell(trn, 1).value = 'TOTAL GENERAL — CIERRE DE MES';
    styleTotal(ws.getCell(trn, 5));
    ws.getCell(trn, 5).alignment = { horizontal: 'center', vertical: 'middle' };
    styleTotalAmount(ws.getCell(trn, 6));
    ws.getCell(trn, 6).numFmt = '"$"#,##0.00';
    totalRow.height = 24;

    // ── Resumen financiero ────────────────────────────────────────
    ws.addRow([]);  // espacio

    const IVA_RATE = 0.16;
    const grandIva   = grandTotal * IVA_RATE;
    const grandFinal = grandTotal + grandIva;

    const summaryDefs = [
      ['TOTAL DE RACIONES',  grandQty,                  false],
      ['SUBTOTAL',           grandTotal,                true ],
      ['IVA (16%)',          grandIva,                  true ],
      ['TOTAL',              grandFinal,                true ],
    ];

    summaryDefs.forEach(([label, value, isMoney]) => {
      const r = ws.addRow(['', '', '', '', label, value]);
      const rn = r.number;
      ws.mergeCells(rn, 1, rn, 4);
      ws.mergeCells(rn, 5, rn, 5);
      const labelCell = ws.getCell(rn, 5);
      labelCell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NAVY } };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      labelCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E8EFF7' } };
      labelCell.border    = { bottom: { style: 'thin', color: { argb: 'CCCCCC' } } };
      const valCell = ws.getCell(rn, 6);
      valCell.font      = { bold: label === 'TOTAL', size: 10, name: 'Arial', color: { argb: label === 'TOTAL' ? WHITE : NAVY } };
      valCell.alignment = { horizontal: 'right', vertical: 'middle' };
      valCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: label === 'TOTAL' ? NAVY : 'E8EFF7' } };
      valCell.border    = { bottom: { style: 'thin', color: { argb: 'CCCCCC' } } };
      if (isMoney) valCell.numFmt = '"$"#,##0.00';
      r.height = 18;
    });

    // ── Sección de firmas ────────────────────────────────────────
    ws.addRow([]);
    ws.addRow([]);

    // Etiquetas de rol
    const sigLabels  = ['SOLICITO:', 'REVISO:', 'REVISO:', 'AUTORIZO:'];
    const sigAreas   = ['ÁREA DE NUTRICIÓN', 'COORDINADOR DE RECURSOS HUMANOS', 'COORDINADOR DE SERVICIOS GENERALES', 'SUBDIRECTOR ADMINISTRATIVO'];
    // Mapeo de columnas: [inicio, fin] para cada sección (6 cols total → 2|1|1|2)
    const sigCols    = [[1,2],[3,3],[4,4],[5,6]];

    // Fila de etiquetas (SOLICITO / REVISO / ...)
    const sigLabelRow = ws.addRow([]);
    sigLabelRow.height = 18;
    sigLabels.forEach((lbl, i) => {
      const [c1, c2] = sigCols[i];
      if (c1 !== c2) ws.mergeCells(sigLabelRow.number, c1, sigLabelRow.number, c2);
      const cell = ws.getCell(sigLabelRow.number, c1);
      cell.value     = lbl;
      cell.font      = { bold: true, size: 9, name: 'Arial', color: { argb: NAVY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Fila de líneas de firma
    const sigLineRow = ws.addRow([]);
    sigLineRow.height = 30;
    sigCols.forEach(([c1, c2]) => {
      if (c1 !== c2) ws.mergeCells(sigLineRow.number, c1, sigLineRow.number, c2);
      const cell = ws.getCell(sigLineRow.number, c1);
      cell.alignment = { horizontal: 'center', vertical: 'bottom' };
      cell.border    = { bottom: { style: 'medium', color: { argb: NAVY } } };
    });

    // Fila de áreas/departamentos
    const sigAreaRow = ws.addRow([]);
    sigAreaRow.height = 24;
    sigAreas.forEach((area, i) => {
      const [c1, c2] = sigCols[i];
      if (c1 !== c2) ws.mergeCells(sigAreaRow.number, c1, sigAreaRow.number, c2);
      const cell = ws.getCell(sigAreaRow.number, c1);
      cell.value     = area;
      cell.font      = { bold: true, size: 8, name: 'Arial', color: { argb: NAVY } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Fila de sellos
    ws.addRow([]);
    const selloRow = ws.addRow([]);
    selloRow.height = 30;
    const selloMap = [[1, 2, 'NOMBRE, FIRMA Y CARGO DE QUIEN RECIBE'], [3, 3, 'SELLO DEL PROVEEDOR'], [5, 6, 'SELLO JEFATURA DEL ÁREA DE NUTRICIÓN']];
    selloMap.forEach(([c1, c2, txt]) => {
      if (c1 !== c2) ws.mergeCells(selloRow.number, c1, selloRow.number, c2);
      const cell = ws.getCell(selloRow.number, c1);
      cell.value     = txt;
      cell.font      = { size: 8, name: 'Arial', color: { argb: '666666' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border    = { top: { style: 'thin', color: { argb: 'CCCCCC' } } };
    });

    // ── Anchos de columna ──
    ws.columns = [
      { width: 18 },
      { width: 16 },
      { width: 28 },
      { width: 16 },
      { width: 12 },
      { width: 16 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Disposition', 'attachment; filename="cierre_de_mes.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { console.error('[purchases]', e); res.status(500).json({ error: e?.message || String(e) }); }
});

module.exports = router;
