<?php

declare(strict_types=1);
define('_JEXEC', 1);
require __DIR__ . '/../plugin/src/Placement/Targets.php';
require __DIR__ . '/../plugin/src/Placement/Directive.php';
require __DIR__ . '/../plugin/src/Presentation/FieldGroupNotes.php';

use SuperSoft\Plugin\System\SmartForms\Presentation\FieldGroupNotes;

$count = 0;
function check(bool $valid, string $message): void {
    global $count;
    if (!$valid) throw new RuntimeException($message);
    ++$count;
}
$marker = '__TEST_NOTE__';
foreach (['(<span>Note</span>: %s)', '(<span>Σημείωση</span>: %s)', 'Note: %s', '[%s]'] as $format) {
    $row = static fn(string $note): string => '<tr><th><div class="small break-word">' . sprintf($format, htmlspecialchars($note, ENT_QUOTES, 'UTF-8')) . '</div></th></tr>';
    $wrap = static fn(string $rows): string => '<table class="table" id="fieldgroupList"><tbody>' . $rows . '</tbody></table>';
    foreach (['^', '+', '-'] as $mode) {
        $note = 'Σημείωση <b>& "quote" @future+ @article-text' . $mode;
        $html = $wrap($row($note));
        $clean = FieldGroupNotes::clean($html, sprintf($format, $marker), $marker);
        check($clean === $wrap($row('Σημείωση <b>& "quote" @future+')), 'List note text or escaping changed');
        check(FieldGroupNotes::clean($clean, sprintf($format, $marker), $marker) === $clean, 'Repeated display cleaning changed note');
        $only = FieldGroupNotes::clean($wrap($row('@article-text' . $mode)), sprintf($format, $marker), $marker);
        check($only === $wrap('<tr><th></th></tr>'), 'Directive-only note left an empty Note label');
    }
    $unknown = $wrap($row('Keep @other^ @article-text? (@article-text+)'));
    check(FieldGroupNotes::clean($unknown, sprintf($format, $marker), $marker) === $unknown, 'Unsupported directives changed');
    $outside = '<table id="otherList">' . $row('Keep @article-text^') . '</table>';
    check(FieldGroupNotes::clean($outside, sprintf($format, $marker), $marker) === $outside, 'Unrelated table changed');
    $empty = $wrap('<tr><th><div class="small break-word"></div></th></tr>');
    check(FieldGroupNotes::clean($empty, sprintf($format, $marker), $marker) === $empty, 'Empty native note changed');
}
$html = '<table id="fieldgroupList"><td><div class="custom-note">@article-text^</div></td></table>';
check(FieldGroupNotes::clean($html, sprintf('(%s)', $marker), $marker) === $html, 'Unknown template override changed');
check(FieldGroupNotes::clean($html, 'No placeholder', $marker) === $html, 'Unknown translation changed');
echo "List note presentation checks: $count passed\n";
