<?php

declare(strict_types=1);
define('_JEXEC', 1);
require __DIR__ . '/../plugin/src/Placement/Targets.php';
require __DIR__ . '/../plugin/src/Placement/Directive.php';
require __DIR__ . '/../plugin/src/Placement/GroupPlacement.php';

use SuperSoft\Plugin\System\SmartForms\Placement\Directive;
use SuperSoft\Plugin\System\SmartForms\Placement\GroupPlacement;

$count = 0;
function check(bool $valid, string $message): void {
    global $count;
    if (!$valid) throw new RuntimeException($message);
    ++$count;
}

foreach (Directive::MODES as $mode => $symbol) {
    $saved = 'Σημείωση χρήστη @article-text' . $symbol;
    $data = GroupPlacement::prepare(['context' => 'com_content.article', 'note' => $saved]);
    check($data['note'] === 'Σημείωση χρήστη', 'Human note not preserved');
    check($data['smartforms_target'] === Directive::TARGET && $data['smartforms_mode'] === $mode, 'Controls not initialized');
    check(GroupPlacement::noteForSave($data) === $saved, 'Edit roundtrip failed');
    check(GroupPlacement::prepare($data) === $data, 'Repeated preparation lost controls');
    $data['smartforms_mode'] = 'after';
    $data['note'] = 'Unsaved edit';
    // Joomla returns original submitted data after title/access validation failures.
    $retry = GroupPlacement::prepare($data);
    check($retry['smartforms_mode'] === 'after' && $retry['note'] === 'Unsaved edit', 'Validation retry lost placement');
    check(GroupPlacement::noteForSave($retry) === 'Unsaved edit @article-text+', 'Retry save failed');
    $retry['smartforms_target'] = 'joomla';
    check(GroupPlacement::noteForSave($retry) === 'Unsaved edit', 'Default position did not clear only supported directive');
}
foreach (['@content^', '@future+', '@article-text?', 'prefix@article-text^', '@article-text^suffix', '(@article-text^)', '@JFORM_ARTICLETEXT^'] as $unknown) {
    check(Directive::parse('Keep ' . $unknown)['note'] === 'Keep ' . $unknown, 'Unsupported token removed');
    check(Directive::parse($unknown)['target'] === 'joomla', 'Unsupported token activated');
}
check(Directive::parse('A @article-text^ B')['note'] === 'A B', 'Inline token parsing failed');
check(Directive::parse('@article-text- Before')['note'] === 'Before', 'Leading token parsing failed');
check(Directive::parse("A\n@article-text+\nB")['note'] === "A\n\nB", 'Line breaks not preserved');
check(Directive::parse('  normal  note  ')['note'] === '  normal  note  ', 'Ordinary whitespace changed');
check(Directive::parse('A @article-text^ @article-text-')['mode'] === 'toggle', 'First-token policy changed');
check(Directive::compose('A @future+ @article-text^ @article-text^', Directive::TARGET, 'before') === 'A @future+ @article-text-', 'Duplicates or unknown directives mishandled');
check(GroupPlacement::noteForSave(['note' => 'API @article-text^']) === 'API @article-text^', 'Non-SmartForms caller changed');
$created = GroupPlacement::prepare(['context' => 'com_content.article', 'note' => 'New']);
$created['smartforms_target'] = Directive::TARGET;
$created['smartforms_mode'] = 'before';
check(GroupPlacement::noteForSave($created) === 'New @article-text-', 'Creation failed');
$created['note'] = str_repeat('α', 240);
check(mb_strlen(GroupPlacement::noteForSave($created)) === 255, 'UTF-8 boundary failed');
$created['note'] .= 'α';
try { GroupPlacement::noteForSave($created); throw new RuntimeException('Oversized note accepted'); }
catch (LengthException $error) { ++$count; }
$created['smartforms_mode'] = 'unexpected';
try { GroupPlacement::noteForSave($created); throw new RuntimeException('Unknown mode accepted'); }
catch (InvalidArgumentException $error) { ++$count; }
echo "Directive and note lifecycle checks: $count passed\n";
