<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Adapter;

defined('_JEXEC') or die;

use Joomla\CMS\Form\Form;
use SuperSoft\Plugin\System\SmartForms\Placement\Directive;
use SuperSoft\Plugin\System\SmartForms\Placement\Targets;

/** Read-only form metadata shared by native Joomla and SmartBrowser layouts. */
final class FormAdapter
{
    public static function supports(Form $form): bool
    {
        $field = match (Targets::formContext($form->getName())) {
            'com_content.article' => 'articletext', 'com_content.categories' => 'description',
            'com_users.user' => 'username', default => null,
        };
        return $field !== null && $form->getField($field) !== false;
    }

    public static function configuration(Form $form, array $groups, string $adapter = 'smartbrowser'): array
    {
        $context = Targets::formContext($form->getName());
        $byId = [];
        foreach ($groups as $group) {
            if (($group->context ?? '') === $context) {
                $byId[(int) $group->id] = $group;
            }
        }
        $placements = [];
        // Use the form's existing sequence, including Joomla's ordering and permission filtering.
        foreach ($form->getFieldsets('com_fields') as $name => $fieldset) {
            if (!preg_match('/^fields-([1-9][0-9]*)$/', $name, $match) || !isset($byId[(int) $match[1]])) {
                continue;
            }
            $group = $byId[(int) $match[1]];
            $placement = Directive::parse((string) $group->note, $context);
            if ($placement['target'] === 'joomla') {
                continue;
            }
            $ids = [];
            foreach ($form->getFieldset($name) as $field) {
                $ids[] = $field->id;
            }
            if ($ids) {
                $placements[] = ['fieldset' => $name, 'target' => $placement['target'], 'mode' => $placement['mode'], 'fieldIds' => $ids];
            }
        }
        return ['adapter' => $adapter, 'context' => $context, 'targets' => Targets::ids($context), 'groups' => $placements];
    }
}
