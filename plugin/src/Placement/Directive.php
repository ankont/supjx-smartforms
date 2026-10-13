<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Placement;

defined('_JEXEC') or die;

/** Only complete, whitespace-delimited tokens for an explicitly supported target are owned. */
final class Directive
{
    public const TARGET = 'article-text';
    public const MODES = ['toggle' => '^', 'before' => '-', 'after' => '+', 'left' => '\\', 'right' => '/'];

    /** First supported token wins; all supported duplicates are removed from the human note. */
    public static function parse(string $note, ?string $context = null): array
    {
        $ids = Targets::ids($context);
        $suffixes = [...array_values(self::MODES), ...array_map(static fn($mode) => ':' . $mode, array_keys(self::MODES))];
        $symbols = implode('|', array_map(static fn($symbol) => preg_quote($symbol, '/'), $suffixes));
        $pattern = '/(?<!\S)@(' . implode('|', array_map(static fn($id) => preg_quote($id, '/'), $ids)) . ')(' . $symbols . ')(?!\S)/u';
        $matches = [[], [], []];
        if ($ids) preg_match_all($pattern, $note, $matches, PREG_OFFSET_CAPTURE);
        $suffix = $matches[2][0][0] ?? null;
        $mode = $suffix === null ? null : (str_starts_with($suffix, ':') ? substr($suffix, 1) : array_search($suffix, self::MODES, true));
        $plain = $note;
        foreach (array_reverse($matches[0]) as [$token, $offset]) {
            $length = strlen($token);
            // Consume one separator space, never trim or normalize the user's remaining text.
            if (substr($plain, $offset + $length, 1) === ' ') {
                ++$length;
            } elseif ($offset > 0 && substr($plain, $offset - 1, 1) === ' ') {
                --$offset;
                ++$length;
            }
            $plain = substr_replace($plain, '', $offset, $length);
        }
        return ['note' => $plain, 'target' => $mode === null ? 'joomla' : $matches[1][0][0], 'mode' => $mode ?? 'toggle'];
    }

    public static function compose(string $note, string $target, string $mode, ?string $context = null): string
    {
        if (!in_array($target, ['joomla', ...Targets::ids($context)], true) || !isset(self::MODES[$mode])) {
            throw new \InvalidArgumentException('Invalid SmartForms placement.');
        }
        $plain = self::parse($note, $context)['note'];
        if ($target === 'joomla') {
            return $plain;
        }
        return $plain . ($plain === '' ? '' : ' ') . '@' . $target . self::MODES[$mode];
    }
}
