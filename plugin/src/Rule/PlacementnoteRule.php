<?php

declare(strict_types=1);

namespace SuperSoft\Plugin\System\SmartForms\Rule;

defined('_JEXEC') or die;

use Joomla\CMS\Form\Form;
use Joomla\CMS\Form\FormRule;
use Joomla\Registry\Registry;
use SuperSoft\Plugin\System\SmartForms\Placement\GroupPlacement;

final class PlacementnoteRule extends FormRule
{
    public function test(\SimpleXMLElement $element, $value, $group = null, ?Registry $input = null, ?Form $form = null)
    {
        try {
            GroupPlacement::noteForSave(array_merge($input ? $input->toArray() : [], ['note' => (string) $value]));
            return true;
        } catch (\InvalidArgumentException | \LengthException $error) {
            return false;
        }
    }
}
