// Utilitários para exportação KML/KMZ
export const exportProject = async (project, format = 'kml') => {
  try {
    if (format === 'kml') {
      await exportToKML(project);
    } else if (format === 'kmz') {
      await exportToKMZ(project);
    }
  } catch (error) {
    console.error(`Erro ao exportar projeto para ${format}:`, error);
    throw error;
  }
};

const exportToKML = async (project) => {
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${project.name}</name>
    <description>${project.description || 'Projeto exportado do Jamaaw App'}</description>
    ${project.points.map((point, index) => `
    <Placemark>
      <name>Ponto ${index + 1}</name>
      <Point>
        <coordinates>${point.lng},${point.lat},0</coordinates>
      </Point>
    </Placemark>`).join('')}
    ${project.routeCoordinates && project.routeCoordinates.length > 0 ? `
    <Placemark>
      <name>Rota</name>
      <LineString>
        <coordinates>
          ${project.routeCoordinates.map(coord => `${coord[1]},${coord[0]},0`).join(' ')}
        </coordinates>
      </LineString>
    </Placemark>` : ''}
  </Document>
</kml>`;

  downloadFile(kmlContent, `${project.name}.kml`, 'application/vnd.google-earth.kml+xml');
};

const exportToKMZ = async (project) => {
  // Para KMZ, usamos a mesma função KML por enquanto
  // Em uma implementação real, aqui seria feito o zip do KML
  await exportToKML(project);
};

const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};