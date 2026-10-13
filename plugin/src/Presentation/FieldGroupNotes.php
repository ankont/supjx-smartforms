<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Presentation;

defined('_JEXEC') or die;

use SuperSoft\Plugin\System\SmartForms\Placement\Directive;

/** Clean only the native list's note fragments, without changing stored data or other markup. */
final class FieldGroupNotes
{
    public static function clean(string $html, string $formattedSample, string $marker, ?string $context = null): string
    {
        $parts = explode($marker, $formattedSample);
        if (count($parts) !== 2) {
            return $html;
        }
        [$prefix, $suffix] = $parts;
        $notePattern = '~(<div\b[^>]*\bclass=(["\'])small break-word\2[^>]*>)\s*'
            . preg_quote($prefix, '~') . '(?<note>[^<]*?)' . preg_quote($suffix, '~') . '\s*</div>~su';

        return preg_replace_callback('~<table\b[^>]*\bid=(["\'])fieldgroupList\1[^>]*>.*?</table>~su',
            static function (array $table) use ($notePattern, $prefix, $suffix, $context): string {
                return preg_replace_callback($notePattern, static function (array $match) use ($prefix, $suffix, $context): string {
                    $note = html_entity_decode($match['note'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $placement = Directive::parse($note, $context);
                    if ($placement['target'] === 'joomla') {
                        return $match[0];
                    }
                    if (trim($placement['note']) === '') {
                        return '';
                    }
                    return $match[1] . $prefix
                        . htmlspecialchars($placement['note'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
                        . $suffix . '</div>';
                }, $table[0]) ?? $table[0];
            }, $html) ?? $html;
    }
}
