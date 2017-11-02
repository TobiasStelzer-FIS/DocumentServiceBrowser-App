/*global location */
sap.ui.define([
	"de/fis/filebrowser/controller/BaseController",
	"sap/ui/Device",
	"sap/ui/model/json/JSONModel",
	"sap/ui/unified/FileUploaderParameter",
	"de/fis/filebrowser/model/formatter"
], function(BaseController, Device, JSONModel, FileUploaderParameter, formatter) {
	"use strict";

	return BaseController.extend("de.fis.filebrowser.controller.Detail", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function() {

			this.getModel("contentModel").attachEvent("requestCompleted", function(oEvent) {

				if (!oEvent.getParameter("success")) {
					this.getRouter().getTargets().display("detailObjectNotFound");
				}

				//if (false) {
				//sap.ui.core.UIComponent.getRouterFor(this).myNavToWithoutHash({
				//		currentView : oView,
				//		targetViewName : "sap.ui.demo.tdg.view.NotFound",
				//		targetViewType : "XML"
				//	});
				//}
				this.getModel("detailView").setProperty("/busy", false);
			}, this);
			//this.getRouter().getTargets().display("detailNoObjectSelected");
			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Updates the item count within the line item table's header
		 * @param {object} oEvent an event containing the total number of items in the list
		 * @private
		 */
		onTableUpdateFinished: function(oEvent) {
			var sTitle,
				iTotalItems = oEvent.getParameter("total"),
				oViewModel = this.getModel("detailView");

			// only update the counter if the length is final
			if (this.byId("folderContentTable").getBinding("items").isLengthFinal()) {
				if (iTotalItems) {
					sTitle = this.getResourceBundle().getText("detailFolderContentTableHeadingCount", [iTotalItems]);
				} else {
					//Display 'Line Items' instead of 'Line items (0)'
					sTitle = this.getResourceBundle().getText("detailFolderContentTableHeading");
				}
				oViewModel.setProperty("/lineItemListTitle", sTitle);
			}
		},

		/**
		 * Navigates to selected folder
		 * @param {object} oEvent an event containing the source of the press-event
		 * @private
		 */
		onBreadcrumbPress: function(oEvent) {
			var oSource = oEvent.getSource();
			var oBindingContext = oSource.getBindingContext("contentModel");
			var sId = oBindingContext.getProperty("Id");

			//this.getOwnerComponent().oListSelector.selectItemById(sId);
			this._loadFolder(sId);
		},

		/**
		 * Navigates to selected folder or opens selected file
		 * @param {object} oEvent an event containing the source of the press-event
		 * @private
		 */
		onItemPressed: function(oEvent) {
			var oBindingContext = oEvent.getParameter("listItem").getBindingContext("contentModel");
			var sId = oBindingContext.getProperty("Id");

			switch (oBindingContext.getProperty("Type")) {
				case "Folder":
					this._loadFolder(sId);
					break;
				case "Document":
					this._loadDocument(sId);
					break;
			}
		},

		/**
		 * Deletes the corresponding folder or document
		 * @param {object} oEvent an event containing the source of the press-event
		 * @private
		 */
		onDeletePressed: function(oEvent) {
			var oListItem = oEvent.getSource().getParent().getParent();
			var oBindingContext = oListItem.getBindingContext("contentModel");

			this._deleteItem(oBindingContext.getProperty("Id"), oBindingContext.getProperty("Type") === "Folder");
		},

		/**
		 * Switches the row to edit mode, so that the name of the Folder/File can be changed
		 * @param {object} oEvent an event containing the source of the press-event
		 * @private
		 */
		onEditPressed: function(oEvent) {
			this._openDialog("RenameDialog");
			
			var oViewModel = this.getModel("detailView");
			var oListItem = oEvent.getSource().getParent().getParent();
			var oBindingContext = oListItem.getBindingContext("contentModel");

			oViewModel.setProperty("/editItem", oBindingContext.getProperty("Id"));
			oViewModel.setProperty("/editName", oBindingContext.getProperty("Name"));
		},

		onEditValueChange: function(oEvent) {
			var sNewValue = oEvent.getParameter("newValue");
			if (sNewValue.length === 0 || sNewValue.includes("\"")) {
				this.getModel("detailView").setProperty("/editValueState", "Error");
			} else {
				this.getModel("detailView").setProperty("/editValueState", "Success");
			}
		},

		onAcceptPressed: function(oEvent) {
			var oViewModel = this.getModel("detailView");
			var sEditItemId = oViewModel.getProperty("/editItem");
			var sNewName = oViewModel.getProperty("/editName");
			var repository = this.getModel("app").getProperty("/selectedRepository");
			
			if (sNewName.length === 0 || sNewName.includes("\"")) {
				sap.m.MessageBox.show("Please input a valid name.");
			} else {
				$.ajax({
					type: "GET",
					url: this.getOwnerComponent().sRootPath + "?action=rename&id=" + sEditItemId + "&name=" + sNewName + "&repository=" + repository,
					data: {}
				}).always(function() {
					this._reloadFolderContent();
					this._reloadHierarchy();
				}.bind(this));
				
				oViewModel.setProperty("/editItem", "-1");
				oViewModel.setProperty("/editName", "");
				oViewModel.setProperty("/editValueState", "Success");
			}
		},

		onDeclinePressed: function(oEvent) {
			var oViewModel = this.getModel("detailView");
			oViewModel.setProperty("/editItem", "-1");
			oViewModel.setProperty("/editName", "");
			oViewModel.setProperty("/editValueState", "Success");
		},

		onCreateFolderPressed: function(oEvent) {
			this._openDialog("CreateFolder");
		},

		onUploadDocumentPressed: function(oEvent) {
			this._openDialog("UploadDocument");
		},

		onCreateFolderSave: function(oEvent) {
			var oViewModel = this.getModel("detailView"),
				oModel = this.getModel("contentModel");
			var sFolderName = oViewModel.getProperty("/newFolderName"),
				sId = oModel.getProperty("/SelectedFolder/Id");
			var repository = this.getModel("app").getProperty("/selectedRepository");
			
			$.ajax({
				type: "GET",
				url: this.getOwnerComponent().sRootPath + "?action=createfolder&parentid=" + sId + "&name=" + sFolderName + "&repository=" + repository,
				data: {}
			}).always(function() {
				this._reloadFolderContent();
				this._reloadHierarchy();
			}.bind(this));

			this._closeDialog();
		},

		onUploadDocumentSave: function(oEvent) {
			var oFileUploader = this.getView().byId("fileUploader");
			var sData = "";
			var repository = this.getModel("app").getProperty("/selectedRepository");
			
			sData += "action:" + "upload;";
			sData += "name:" + oFileUploader.getValue() + ";";
			sData += "parentid:" + this._getSelectedFolderId() + ";";
			sData += "repository:" + repository;
			
			oFileUploader.setAdditionalData(sData);
			oFileUploader.setUploadUrl(this.getOwnerComponent().sRootPath);
			oFileUploader.attachEvent("uploadComplete", function() {
				this._reloadFolderContent();
				this._reloadHierarchy();
			}, this);
			oFileUploader.upload();

			this._closeDialog();
		},

		onDialogCancel: function(oEvent) {
			this._closeDialog();
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		_initViewModel: function() {
			var oModel = this.getModel("detailView");

			oModel.setProperty("lineItemListTitle", this.getResourceBundle().getText("detailFolderContentTableHeading"));
		},

		_loadFolder: function(sId) {
			var repository = this.getModel("app").getProperty("/selectedRepository");
			this.getModel("contentModel").loadData(this.getOwnerComponent().sRootPath + "?action=navigate&id=" + sId + "&repository=" + repository);
			this.getModel("detailView").setProperty("/busy", true);
		},

		_loadDocument: function(sId) {
			var repository = this.getModel("app").getProperty("/selectedRepository");
			window.open(this.getOwnerComponent().sRootPath + "/" + repository + "/" + sId, '_blank');
		},

		_reloadFolderContent: function() {
			var sId = this._getSelectedFolderId();

			this._loadFolder(sId);
		},

		_reloadHierarchy: function() {
			var repository = this.getModel("app").getProperty("/selectedRepository");
			this.getModel("hierarchyModel").loadData(this.getOwnerComponent().sRootPath + "?action=hierarchy&repository=" + repository);
			this.getModel("masterView").setProperty("/busy", true);
		},

		_deleteItem: function(sId, bReloadHierarchy) {
			$.ajax({
				type: "GET",
				url: this.getOwnerComponent().sRootPath + "?action=delete&id=" + sId + "&repository=" + repository,
				data: {}
			}).always(function() {
				this._reloadFolderContent();
				if (bReloadHierarchy)
					this._reloadHierarchy();
			}.bind(this));
		},

		_getSelectedFolderId: function() {
			return this.getModel("contentModel").getProperty("/SelectedFolder/Id");
		},

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var sObjectId = oEvent.getParameter("arguments").objectId;
			var oViewModel = this.getModel("detailView");
			
			oViewModel.setProperty("/editItem", "-1");
			oViewModel.setProperty("/editName", "");
			oViewModel.setProperty("/editValueState", "Success");
			
			this._loadFolder(sObjectId);

			//				this.getModel().metadataLoaded().then( function() {
			//					var sObjectPath = this.getModel().createKey("Applicants", {
			//						ApplicantId :  sObjectId
			//					});
			//					this._bindView("/" + sObjectPath);
			//				}.bind(this));
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function(sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel().getObject(this.sPath),
				sObjectId = oObject.ApplicantId,
				sObjectName = oObject.Lastname,
				oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(this.sPath);

			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		onNavBack: function() {
			this.getRouter().navTo("master");
		},

		/**
		 * Shows the selected item on the detail page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showDetail: function(sObjectId) {
			var bReplace = !Device.system.phone;
			this.getRouter().navTo("object", {
				objectId: sObjectId
			}, bReplace);
		},

		_getDialog: function(sFragmentName) {
			if (!this._dialogs)
				this._dialogs = [];

			var oDialog = this._dialogs[sFragmentName];

			if (!oDialog) {
				oDialog = sap.ui.xmlfragment(this.getView().getId(), "de.fis.filebrowser.view.fragment." + sFragmentName, this);
				this.getView().addDependent(oDialog);
				this._dialogs[sFragmentName] = oDialog;
			}
			return oDialog;
		},

		_openDialog: function(sFragmentName) {
			this._currentDialog = this._getDialog(sFragmentName);
			this._currentDialog.open();
			return this._currentDialog;
		},

		_closeDialog: function() {
			this.getModel("detailView").setProperty("/newFolderName", "");
			this.getModel("detailView").setProperty("/valueFileUploader", "");
			this._currentDialog.close();
		}
	});

});