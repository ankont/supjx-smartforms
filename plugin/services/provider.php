<?php

defined('_JEXEC') or die;

use Joomla\CMS\Extension\PluginInterface;
use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\PluginHelper;
use Joomla\DI\Container;
use Joomla\DI\ServiceProviderInterface;
use SuperSoft\Plugin\System\SmartForms\Extension\SmartForms;

return new class () implements ServiceProviderInterface {
    public function register(Container $container): void
    {
        $container->set(PluginInterface::class, static function () {
            $app = Factory::getApplication();
            $plugin = new SmartForms($app->getDispatcher(), (array) PluginHelper::getPlugin('system', 'smartforms'));
            $plugin->setApplication($app);
            return $plugin;
        });
    }
};
