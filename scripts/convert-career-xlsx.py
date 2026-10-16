"""Convert the supplied two-column, one-partner-per-sheet workbook without evaluating formulas."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ALIASES = {'web programming': 'Web Programing', 'digital marketing': 'Digital Marekting', 'teknisi dan jaringan': 'Teknisi dan Jaringan'}

def convert(path):
    result = []
    with zipfile.ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(node.itertext()) for node in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', NS)]
        sheets = sorted(name for name in archive.namelist() if name.startswith('xl/worksheets/sheet') and name.endswith('.xml'))
        for sheet in sheets:
            fields = {}
            for row in ET.fromstring(archive.read(sheet)).findall('.//s:sheetData/s:row', NS):
                cells = {}
                for cell in row.findall('s:c', NS):
                    if cell.find('s:f', NS) is not None:
                        raise ValueError('Formula cells are not supported')
                    value = cell.find('s:v', NS)
                    text = value.text if value is not None else ''
                    if cell.get('t') == 's':
                        text = strings[int(text)]
                    elif cell.get('t') == 'inlineStr':
                        text = ''.join(cell.find('s:is', NS).itertext())
                    cells[''.join(c for c in cell.get('r') if c.isalpha())] = (text or '').strip()
                if cells.get('A') and cells.get('B'):
                    fields[cells['A']] = cells['B']
            acceptance = {'Menerima': 'open', 'Belum dikonfirmasi': 'unknown', 'Tidak menerima': 'closed'}[fields['Status penerimaan']]
            verification = fields['Verifikasi']
            if verification not in ['Sudah dikonfirmasi akademik atau mitra', 'Belum dikonfirmasi']:
                raise ValueError('Unrecognized verification status')
            categories = [ALIASES.get(c.strip().lower(), c.strip()) for c in fields['Kategori yang sesuai'].split(',')]
            result.append({
                'branch': fields['Cabang PalComTech'], 'name': fields['Nama perusahaan/instansi'],
                'request_types': [t.strip() for t in fields['Jenis kegiatan yang diterima'].split(',')],
                'categories': categories, 'skills': [s.strip() for s in fields['Keahlian yang dibutuhkan'].split(',')],
                'location': fields['Lokasi'], 'description': fields['Tugas siswa'],
                'acceptance': acceptance, 'verified': verification == 'Sudah dikonfirmasi akademik atau mitra',
                'source': 'Daftar Mitra Perusahaan untuk PKL.xlsx',
            })
    if not result or len({(p['branch'], p['name']) for p in result}) != len(result):
        raise ValueError('Empty workbook or duplicate partner profiles')
    return result

if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python3 scripts/convert-career-xlsx.py input.xlsx output.json')
    rows = convert(sys.argv[1])
    with open(sys.argv[2], 'w', encoding='utf-8') as output:
        json.dump(rows, output, ensure_ascii=False, indent=2)
        output.write('\n')
    print(f'Converted {len(rows)} profiles')
