"""Validate the built installer, source parity, versions and translation coverage."""
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

root = Path(__file__).resolve().parents[1]
plugin = root / 'plugin'
manifest = ET.parse(plugin / 'smartforms.xml').getroot()
version = manifest.findtext('version')
assert manifest.attrib == {'type': 'plugin', 'group': 'system', 'method': 'upgrade'}
assert manifest.findtext('namespace') == r'SuperSoft\Plugin\System\SmartForms'
assert manifest.find('files/folder').attrib.get('plugin') == 'smartforms'
for filename in ('package.json', 'package-lock.json', 'plugin/media/joomla.asset.json'):
    data = json.loads((root / filename).read_text(encoding='utf-8'))
    assert data['version'] == version, filename
assets = json.loads((plugin / 'media/joomla.asset.json').read_text(encoding='utf-8'))
assert all(asset['version'] == version for asset in assets['assets'])
script = next(asset for asset in assets['assets'] if asset['type'] == 'script')
assert script['dependencies'] == ['core'] and not script.get('attributes'), 'Bootstrap must precede deferred editor scripts'
for element in manifest.find('files'):
    assert (plugin / element.text).exists(), element.text
for element in manifest.find('languages'):
    assert (plugin / element.text).is_file(), element.text
for element in manifest.find('media'):
    assert (plugin / 'media' / element.text).exists(), element.text
for xml in plugin.rglob('*.xml'):
    ET.parse(xml)

keys = set()
for file in plugin.rglob('*'):
    if file.suffix in ('.php', '.xml'):
        keys.update(re.findall(r'PLG_SYSTEM_SMARTFORMS[A-Z0-9_]*', file.read_text(encoding='utf-8')))
language_sets = []
for language in ('en-GB', 'el-GR'):
    strings = {}
    for file in (plugin / 'language' / language).glob('*.ini'):
        for line in file.read_text(encoding='utf-8').splitlines():
            if '=' in line:
                key, value = line.split('=', 1)
                assert value.startswith('"') and value.endswith('"'), line
                assert '"' not in value[1:-1], line
                strings[key] = value
    assert keys <= strings.keys(), keys - strings.keys()
    language_sets.append(set(strings))
assert language_sets[0] == language_sets[1]

archive_path = root / 'build' / 'output' / f'plg_system_smartforms-v{version}.zip'
with zipfile.ZipFile(archive_path) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert 'smartforms.xml' in names
    assert len(names) == len(set(names))
    assert all('\\' not in name and not name.startswith('/') and '..' not in Path(name).parts for name in names)
    expected = {file.relative_to(plugin).as_posix(): file for file in plugin.rglob('*') if file.is_file()}
    assert {name for name in names if not name.endswith('/')} == set(expected)
    for name, file in expected.items():
        assert archive.read(name) == file.read_bytes(), name
print(f'Package verified: {archive_path.name}; {len(expected)} source files; versions and EN/EL strings consistent')
