import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Layout genérico reaproveitado pelos 3 relatórios (Atendimentos/Comercial/
// Instalações) — cada página só monta suas próprias colunas/linhas já
// formatadas em string, sem lógica de domínio aqui.
const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#666666", marginBottom: 12 },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  cell: { flex: 1, paddingHorizontal: 2 },
  headerCell: { flex: 1, paddingHorizontal: 2, fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    fontSize: 8,
    color: "#999999",
    textAlign: "center",
  },
});

export function ReportPdfDocument({
  title,
  subtitle,
  columns,
  rows,
  generatedAt,
}: {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  generatedAt: string;
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        <View style={styles.headerRow}>
          {columns.map((column) => (
            <Text key={column} style={styles.headerCell}>
              {column}
            </Text>
          ))}
        </View>

        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row} wrap={false}>
            {row.map((cell, cellIndex) => (
              <Text key={cellIndex} style={styles.cell}>
                {cell}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Gerado em {generatedAt} · {rows.length} registro(s)
        </Text>
      </Page>
    </Document>
  );
}
