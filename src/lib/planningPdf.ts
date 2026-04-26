// Export PDF du planning (mois courant ou précédent).
// N'utilise que la collection schedules. Aucun calcul de salaire n'est inclus.
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ScheduleEntry } from './scheduleStore';
import { DynamicShift } from './shiftsStore';
import { User } from '@/contexts/AuthContext';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export function exportPlanningPDF(opts: {
  year: number;
  month: number;       // 0-11
  users: User[];       // déjà ordonnés
  entries: ScheduleEntry[];
  shiftsByCode: Map<string, DynamicShift>;
}) {
  const { year, month, users, entries, shiftsByCode } = opts;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  pdf.setFontSize(14);
  pdf.text(`Planning — ${MONTHS[month]} ${year}`, 40, 30);
  pdf.setFontSize(9);
  pdf.text(`Édité le ${new Date().toLocaleDateString('fr-FR')}`, 40, 46);

  const head = [['Agent', ...days.map(d => String(d)), 'Total']];
  const body = users.map(u => {
    let total = 0;
    const cells = days.map(d => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const e = entries.find(x => x.userId === u.id && x.date === dateStr);
      if (!e) return '';
      if (e.shiftCode !== 'ABS') {
        total += shiftsByCode.get(e.shiftCode)?.hours || 0;
      }
      return e.shiftCode;
    });
    return [u.name, ...cells, `${total}h`];
  });

  autoTable(pdf, {
    head,
    body,
    startY: 60,
    styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left', cellWidth: 90, fontStyle: 'bold' },
      [days.length + 1]: { fontStyle: 'bold', fillColor: [243, 244, 246] },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0 && data.column.index <= days.length) {
        const d = days[data.column.index - 1];
        const dow = new Date(year, month, d).getDay();
        if (dow === 0 || dow === 6) {
          data.cell.styles.fillColor = [185, 28, 28];
        }
      }
      if (data.section === 'body' && data.column.index > 0 && data.column.index <= days.length) {
        const d = days[data.column.index - 1];
        const dow = new Date(year, month, d).getDay();
        if (dow === 0 || dow === 6) {
          data.cell.styles.fillColor = [243, 244, 246];
        }
      }
    },
  });

  pdf.save(`planning-${year}-${String(month + 1).padStart(2, '0')}.pdf`);
}
