'use strict';

/**
 * HackBrowserWindow controls all activities related to a browser window
 * all browser-related public-APIs can be accessed through HackBrowserWindow instance
 *
 * @constructor
 */
class HackBrowserWindow {
	const remote = require('electron').remote;

	/* ====================================
	 private member variables
	 ====================================== */
	var ipcHandler;
	var navigationControls;
	var browserTabBar;
	var addressBar;
	var autoCompleteBox;
	var userMenu; 
	var navigationHistoryHandler;
	var contextMenuHandler;
	var activeTabView;
	var createdTabViewCount;
	var openTabViewCount;
	var tabList;


	/* ====================================
	 private methods
	 ====================================== */
	constructor() {
		// note that handler for IPC communication be initialized before other view components
		ipcHandler = new IPCRendererProcessHandler(this);

		// create a new NavigationControls object associated with current browser window
		navigationControls = new NavigationControls(this);
		browserTabBar = new BrowserTabBar(this);
		addressBar = new AddressBar(this);
		autoCompleteBox = new AutoCompleteBox(this);
		userMenu = new UserMenu(this); 
		navigationHistoryHandler = new NavigationHistoryHandler(this);
		contextMenuHandler = new ContextMenuHandler(this);
		createdTabViewCount = 0;
		openTabViewCount = 0;
		tabList = {};

		var initialURL = remote.getCurrentWindow().initialURL ? remote.getCurrentWindow().initialURL : "http://www.google.com";

		this.addNewTab(initialURL, true);

		attachEventHandlers();
	};

	function attachEventHandlers() {
		// shortcuts
		key('⌘+f, ctrl+f', function() {
			activeTabView.getSearchBox().open();
		});

		// TODO: temporarily refresh browser page for debugging
		key('ctrl+r', function() {
			console.log("reloading browser page");

			document.location.reload(true);
		});

		key('esc', function() {
			activeTabView.getSearchBox().close();
		});
	};


	/* ====================================
	 public methods
	 ====================================== */
	/**
	 * Navigate to a url
	 *
	 * @param url {string} new url
	 */
	function navigateTo(url) {
		activeTabView.navigateTo(url);
	};

	/**
	 * Updates window's title
	 *
	 * @param title {string} new title of the browser window
	 */
	function updateWindowTitle(title) {
		document.title = title;
	};

	/**
	 * Create a new browser tab
	 *
	 * @param url {string} URL to open, if left null, a "blank-page" will be displayed
	 * @param activate {boolean} whether to activate the new tab immediately (optional, defaults to true)
	 *
	 * @returns {string} ID of new tab
	 */
	function addNewTab(url, activate) {
		var newTabView = new TabView(this, browserTabBar, url);
		var newTabViewId = newTabView.getId();

		// the default option for activating tab
		// if no argument was supplied for "activate" option, turn it on
		if (activate === undefined) { activate = true; }

		// add TabView to list
		tabList[newTabViewId] = newTabView;

		// activate tab
		if (activate === true) {
			this.activateTabById(newTabViewId);

			if (!addressBar.isAddressBarFocused()) {
				addressBar.focusOnAddressBar();
			}
		}

		// increase open tab count
		openTabViewCount++;

		return newTabViewId;
	};

	/**
	 * activates a tab
	 *
	 * @param {int} tabViewId
	 */
	function activateTabById(tabViewId) {
		console.log("activateTabById(" + tabViewId + ")");

		if (activeTabView && (activeTabView.getId() === tabViewId)) {
			console.log("already active tab");
			return;
		}

		if(tabList.hasOwnProperty(tabViewId) === true) {
			if (activeTabView) {
				activeTabView.deactivate();
			}

			activeTabView = tabList[tabViewId];

			// activate new tab view
			activeTabView.activate();

			this.updateWindowControls();
		}
	};

	/**
	 * updates back/forward buttons' enable/disable status
	 */
	function updateWindowControls() {
		// Check if active webview is still loading
		// if webViewEl.canGoBack() or webViewEl.canGoForward() is called in navigationControls.updateBtnStatus()
		// before <webview> element is loaded, an exception will be thrown
		if (activeTabView.isDOMReady() === true) {
			// update back/forward button status
			navigationControls.updateBtnStatus(activeTabView.getWebViewEl());

			// update reload button
			if (activeTabView.getWebViewEl().isLoading() === true) {
				navigationControls.showLoadStopBtn();
			} else {
				navigationControls.showReloadBtn();
			}
		} else {
			navigationControls.disableBackBtn();
			navigationControls.disableForwardBtn();
		}

		this.updateWindowTitle(activeTabView.getWebViewTitle());
		addressBar.updateURL(activeTabView.getURL());
	};

	/**
	 * return BrowserTabBar handler
	 *
	 * @returns {BrowserTabBar} BrowserTabBar view component
	 */
	function getBrowserTabBar() {
		return browserTabBar;
	};

	/**
	 * return NavigationControls handler
	 *
	 * @returns {NavigationControls} NavigationControls view component
	 */
	function getNavigationControls() {
		return navigationControls;
	};

	/**
	 * return active TabView object
	 *
	 * @returns {TabView} currently active TabView object
	 */
	function getActiveTabView() {
		return activeTabView;
	};

	/**
	 * increment total number of created tabs including closed ones
	 * this method should be exposed publicly in case a new tab is created programmatically
	 */
	function incrementCreatedTabViewCount() {
		createdTabViewCount++;
	};

	/**
	 * return number of total created tabs including closed ones
	 *
	 * @returns {int} created tab count
	 */
	function getCreatedTabViewCount() {
		return createdTabViewCount;
	};

	/**
	 * navigate back on active TabView
	 *
	 * @returns {boolean} whether navigating backwards was successful
	 */
	function goBack() {
		var didGoBack = false;

		if ((activeTabView.isDOMReady() === true) && (activeTabView.getWebViewEl().canGoBack() === true)) {
			activeTabView.getWebViewEl().goBack();
			didGoBack = true;
		}

		return didGoBack;
	};

	/**
	 * navigate forward on active TabView
	 *
	 * @returns {boolean} whether navigating forward was successful
	 */
	function goForward() {
		var didGoForward = false;

		if ((activeTabView.isDOMReady() === true) && (activeTabView.getWebViewEl().canGoForward() === true)) {
			activeTabView.getWebViewEl().goForward();
			didGoForward = true;
		}

		return didGoForward;
	};

	/**
	 * reload (refresh) page on active TabView
	 */
	function reload() {
		activeTabView.getWebViewEl().reload();
	};

	/**
	 * stop loading a page on active TabView
	 */
	function stopLoading() {
		activeTabView.getWebViewEl().stop();
	};

	/**
	 * remove specific TabView object from tabList object
	 * for garbage collection
	 *
	 * this method should be called when a tab is closed in the browser
	 *
	 * @param tabViewId
	 */
	function handleTabCloseById(tabViewId) {
		var tabViewToClose = tabList[tabViewId];

		// remove <webview> element
		tabViewToClose.close();

		// remove tabView from tabList map
		delete tabList[tabViewId];

		openTabViewCount--;

		// if no tabs are open, close window
		if (openTabViewCount === 0) {
			var currentWindow = remote.getCurrentWindow();
			currentWindow.close();
		}
	}; 

	/**
	 * getter for ContextMenuHandler
	 *
	 * @returns {ContextMenuHandler} handler for context menu actions
	 */
	function getContextMenuHandler() {
		return contextMenuHandler;
	};

	/**
	 * getter for IPC Renderer Process handler
	 */
	function getIPCHandler() {
		return ipcHandler;
	};


	/**
	 * getter for address bar handler
	 */
	function getAddressBar() {
		return addressBar;
	};

	/**
	 * getter for navigation history handler
	 */
	function getNavigationHistoryHandler() {
		return navigationHistoryHandler;
	};

	/**
	 * getter for auto complete box
	 */
	function getAutoCompleteBox() {
		return autoCompleteBox; 
	};
	
	init();
}
