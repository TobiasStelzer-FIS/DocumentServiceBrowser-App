/*global history */
sap.ui.define(["de/fis/filebrowser/controller/BaseController",
	"sap/ui/model/json/JSONModel", "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator", "sap/m/GroupHeaderListItem",
	"sap/ui/Device", "de/fis/filebrowser/model/formatter"
], function(
	BaseController, JSONModel, Filter, FilterOperator, GroupHeaderListItem,
	Device, formatter) {
	"use strict";

	return BaseController.extend("de.fis.filebrowser.controller.Master", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods */
		/* =========================================================== */

		/**
		 * Called when the master list controller is instantiated. It sets up
		 * the event handling for the master/detail communication and other
		 * lifecycle tasks.
		 * 
		 * @public
		 */
		onInit: function() {
			// Control state model
			var oTree = this.byId("Tree"),
				hierarchyModel = this
				.getModel("hierarchyModel"),
				oViewModel = this
				.getModel("masterView"),
				oSelectRepository = this.getView().byId("selectRepository");

			this.getOwnerComponent().oListSelector.setBoundMasterList(oTree);
			this._initViewModel();
			oViewModel.setProperty("/busy", true);

			hierarchyModel.attachEventOnce("requestCompleted", function() {
				oTree.expandToLevel(1);
				oViewModel.setProperty("/busy", false);
				var oItem = oTree.getItems()[0];
				// oTree.setSelectedItem(oItem, true, true);
				// this._showDetail(oItem);
				var oBinding = oTree.getBinding("items");
				oBinding.attachEvent("change", this.onUpdateFinished, this);
			}, this);

			// Automatically select first repository-item
			var firstRepositoryName = this.getModel("app").getProperty("/repositories/0/name");
			this.getModel("app").setProperty("/selectedRepository", firstRepositoryName);
			
			var repository = this.getModel("app").getProperty("/selectedRepository");
			hierarchyModel.loadData(this.getOwnerComponent().sRootPath + "?action=hierarchy&repository=" + repository);

			// keeps the filter and search state
			this._oListFilterState = {
				aSearch: []
			};

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data
			// is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)

			this.getRouter().getRoute("master").attachPatternMatched(
				this._onMasterMatched, this);
			this.getRouter().attachBypassed(this.onBypassed, this);
		},

		/* =========================================================== */
		/* event handlers */
		/* =========================================================== */

		onRepositoryChange: function(event) {
			var item = event.getParameter("selectedItem");
			this.getModel("app").setProperty("/selectedRepository", item.getKey());
			this.onRefresh();
		},
		
		/**
		 * After list data is available, this handler method updates the master
		 * list counter and hides the pull to refresh control, if necessary.
		 * 
		 * @param {sap.ui.base.Event}
		 *            oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function(oEvent) {
			// hide pull to refresh if necessary
			this.byId("pullToRefresh").hide();
			this.getModel("masterView").setProperty("/busy", false);
			var oTree = this.getView().byId("Tree");
			oTree.rerender();
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort and group
		 * settings and refreshes the list binding.
		 * 
		 * @public
		 */
		onRefresh: function() {
			var repository = this.getModel("app").getProperty("/selectedRepository");
			this.getModel("hierarchyModel").loadData(
				this.getOwnerComponent().sRootPath + "?action=hierarchy&repository=" + repository);
			this.getModel("masterView").setProperty("/busy", true);
		},

		/**
		 * Event handler for the tree item pressed event
		 * 
		 * @param {sap.ui.base.Event}
		 *            oEvent the list itemPress event
		 * @public
		 */
		onItemPressed: function(oEvent) {
			// get the list item, either from the listItem parameter or from the
			// event's source itself (will depend on the device-dependent mode).
			var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
			this._showDetail(oItem);
			// oItem.expand(true);
		},

		/**
		 * Event handler for the bypassed event, which is fired when no routing
		 * pattern matched. If there was an object selected in the master list,
		 * that selection is removed.
		 * 
		 * @public
		 */
		onBypassed: function() {
			this.getView().byId("Tree").removeSelections(true);
		},

		/**
		 * Event handler for navigating back. We navigate back in the browser
		 * historz
		 * 
		 * @public
		 */
		onNavBack: function() {
			history.go(-1);
		},

		/* =========================================================== */
		/* begin: internal methods */
		/* =========================================================== */

		_initViewModel: function() {
			var oModel = this.getModel("masterView");

			oModel.setProperty("title", this.getResourceBundle().getText(
				"masterTitleCount", [0]));
			oModel.setProperty("noDataText", this.getResourceBundle().getText(
				"masterListNoDataText"));
		},

		/**
		 * If the master route was hit (empty hash) we have to set the hash to
		 * to the first item in the list as soon as the listLoading is done and
		 * the first item in the list is known
		 * 
		 * @private
		 */
		_onMasterMatched: function() {
			this.getOwnerComponent().oListSelector.oWhenListLoadingIsDone.then(
				function(mParams) {
					if (mParams.list.getMode() === "None") {
						return;
					}
					var sObjectId = mParams.firstListitem
						.getBindingContext().getProperty("Id");
					this.getRouter().navTo("object", {
						objectId: sObjectId
					}, true);
				}.bind(this),
				function(mParams) {
					if (mParams.error) {
						return;
					}
					this.getRouter().getTargets().display(
						"detailNoObjectsAvailable");
				}.bind(this));
		},

		/**
		 * Shows the selected item on the detail page On phones a additional
		 * history entry is created
		 * 
		 * @param {sap.m.ObjectListItem}
		 *            oItem selected Item
		 * @private
		 */
		_showDetail: function(oItem) {
			var bReplace = !Device.system.phone;
			this.getRouter().navTo(
				"object", {
					repository: this.getModel("app").getProperty("/selectedRepository"),
					objectId: oItem.getBindingContext("hierarchyModel")
						.getProperty("Id")
				}, bReplace);
		},

		/**
		 * Internal helper method to apply both filter and search state together
		 * on the list binding
		 * 
		 * @private
		 */
		_applyFilterSearch: function() {
			var aFilters = this._oListFilterState.aSearch
				.concat(this._oListFilterState.aFilter),
				oViewModel = this
				.getModel("masterView");
			var oTree = this.getView().byId("Tree");

			oTree.getBinding("items").filter(aFilters, "Application");

			// changes the noDataText of the list in case there are no filter
			// results
			if (aFilters.length !== 0) {
				oViewModel.setProperty("/noDataText", this.getResourceBundle()
					.getText("masterListNoDataWithFilterOrSearchText"));
			} else if (this._oListFilterState.aSearch.length > 0) {
				// only reset the no data text to default when no new search was
				// triggered
				oViewModel.setProperty("/noDataText", this.getResourceBundle()
					.getText("masterListNoDataText"));
			}
		}

	});

});