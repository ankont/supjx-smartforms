<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Placement;

defined('_JEXEC') or die;

/** Transient form values only. The database note remains the sole persisted configuration. */
final class GroupPlacement
{
    public static function prepare(array $data): array
    {
        $placement = Directive::parse((string) ($data['note'] ?? ''), $data['context'] ?? null);
        if ((string) ($data['smartforms_present'] ?? '') !== '1') {
            $data['smartforms_target'] = $placement['target'];
            $data['smartforms_mode'] = $placement['mode'];
        }
        $data['note'] = $placement['note'];
        $data['smartforms_present'] = 1;
        return $data;
    }

    public static function noteForSave(array $data): string
    {
        $note = (string) ($data['note'] ?? '');
        if ((string) ($data['smartforms_present'] ?? '') !== '1') {
            return $note;
        }
        $note = Directive::compose($note, (string) ($data['smartforms_target'] ?? ''), (string) ($data['smartforms_mode'] ?? ''), $data['context'] ?? null);
        // Joomla's native fields_groups.note is varchar(255); never silently truncate a directive.
        if (mb_strlen($note, 'UTF-8') > 255) {
            throw new \LengthException('PLG_SYSTEM_SMARTFORMS_NOTE_TOO_LONG');
        }
        return $note;
    }
}
