sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/ui/Device"
], function(JSONModel, Device) {
	"use strict";

	return {
		createDeviceModel: function() {
			var oModel = new JSONModel(Device);
			oModel.setDefaultBindingMode("OneWay");
			return oModel;
		},

		createAppModel: function() {
			return new JSONModel({
				selectedRepository: "test",
				repositories: [{
					name: "test",
					description: "Test"
				}, {
					name: "012ff4cf-f267-4fcd-befc-22cfd618a71a",
					description: "FIS Development"
				}]
			});
		},
		
		createMasterViewModel: function() {
			return new JSONModel({
				isFilterBarVisible: false,
				filterBarLabel: "",
				delay: 0,
				busy: false,
				title: "",
				noDataText: "",
				sortBy: "Lastname",
				groupBy: "None"
			});
		},

		createDetailViewModel: function() {
			return new JSONModel({
				busy: false,
				delay: 0,
				lineItemListTitle: "",
				newFolderName: "",
				valueFileUploader: "",
				editItem: -1,
				editName: "",
				editValueState: "Success"
			});
		}
	};

});