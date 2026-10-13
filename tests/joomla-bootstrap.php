<?php

declare(strict_types=1);
define('_JEXEC', 1);
define('JDEBUG', false);
$joomlaRoot = getenv('SMARTFORMS_JOOMLA_ROOT') ?: dirname(__DIR__, 3) . '/JoomlaTest/site';
if (!is_file($joomlaRoot . '/libraries/bootstrap.php')) {
    throw new RuntimeException('Set SMARTFORMS_JOOMLA_ROOT to a Joomla 5/6 installation to run native lifecycle tests.');
}
define('JPATH_BASE', $joomlaRoot);
require JPATH_BASE . '/includes/defines.php';
require JPATH_BASE . '/libraries/bootstrap.php';
error_reporting(E_ALL & ~E_USER_DEPRECATED & ~E_DEPRECATED);
$loader->addPsr4('SuperSoft\\Plugin\\System\\SmartForms\\', dirname(__DIR__) . '/plugin/src');

use Joomla\CMS\Application\CMSApplication;
use Joomla\CMS\Document\HtmlDocument;
use Joomla\CMS\Factory;
use Joomla\CMS\Language\Language;
use Joomla\Event\Dispatcher;
use Joomla\Input\Input;
use Joomla\Registry\Registry;

class SmartFormsTestApplication extends CMSApplication {
    protected function doExecute(): void {}
    public string $testClient = 'administrator';
    public Input $testInput;
    public array $testGroups = [];
    public function __construct() {
        $this->config = new Registry(['debug' => false]);
        $this->testInput = new Input();
        $this->language = new Language('en-GB');
        $this->language->load('plg_system_smartforms', dirname(__DIR__) . '/plugin');
        $this->document = new HtmlDocument();
        $this->setDispatcher(new Dispatcher());
    }
    public function isClient($identifier) { return $identifier === $this->testClient; }
    public function getInput(): Input { return $this->testInput; }
    public function getTemplate($params = false) { return $params ? (object) ['template' => 'atum', 'parent' => ''] : 'atum'; }
    public function bootComponent($component): \Joomla\CMS\Extension\ComponentInterface {
        throw new RuntimeException('Lifecycle unit tests do not boot database components.');
    }
}
$app = new SmartFormsTestApplication();
Factory::$application = $app;
Factory::$language = $app->getLanguage();
Factory::$document = $app->getDocument();

// Native form fields accept a database service even when they never query it.
// This driver is deliberately disconnected: these tests never read or write Joomla data.
$testDatabase = new \Joomla\Database\Mysqli\MysqliDriver(['host' => 'unused', 'database' => 'unused']);
function nativeForm(string $name, array $options = []): \Joomla\CMS\Form\Form {
    global $testDatabase;
    $form = new \Joomla\CMS\Form\Form($name, $options);
    $form->setDatabase($testDatabase);
    $form->setCurrentUser(new \Joomla\CMS\User\User());
    return $form;
}
