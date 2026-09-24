// Full-page English/Hindi translation dictionary for the Kolors tablet app.
// Keys are grouped by screen/area. `t(key, params)` looks up the current
// language's string and substitutes any `{param}` placeholders it contains.
const TRANSLATIONS = {
  en: {
    "app.title": "Kolors — Die / Tool Tracking",
    "nav.newDie": "New Die / Add Parts",
    "nav.entry": "Entry",
    "nav.track": "Track a Die",

    "role.title": "Select Login Type",
    "role.admin": "Admin",
    "role.workshop": "Workshop",
    "role.back": "◀ Back",
    "role.logout": "Logout",

    "workshopLogin.title": "Workshop Login",

    "login.title": "Admin Login",
    "login.idLabel": "Login ID",
    "login.idPlaceholder": "Login ID",
    "login.passwordLabel": "Password",
    "login.passwordPlaceholder": "Password",
    "login.button": "Login",
    "login.checking": "Checking…",
    "login.error": "Invalid login ID or password.",
    "login.offlineError": "Could not check login — no internet?",

    "tool.heading": "Add a New Die",
    "tool.idLabel": "Project ID",
    "tool.idPlaceholder": "e.g. PT-170",
    "tool.descLabel": "Description",
    "tool.descPlaceholder": "e.g. KLICK SPN Plastic Door 4 Way Knockout Tool",
    "tool.productLabel": "Product Name",
    "tool.productPlaceholder": "optional",
    "tool.typeOfProjectLabel": "Type Of Project",
    "tool.projectStartDateLabel": "Project Start Date",
    "tool.addButton": "Add Die",
    "tool.added": "Die {id} added.",
    "tool.addFailed": "Failed to add die.",
    "tool.noDiesAddAbove": "No dies yet — add one above",
    "tool.noDies": "No dies yet",
    "tool.editButton": "Edit Die",
    "tool.deleteButton": "Delete Die",
    "tool.saveButton": "Save",
    "tool.cancelButton": "Cancel",
    "tool.selectDieFirst": "Select a die above first.",
    "tool.updated": "Die {id} updated.",
    "tool.updateFailed": "Failed to update die.",
    "tool.deleteConfirm": "Delete die {id}? This also deletes all of its parts, operation history, OutSource entries, and child parts.",
    "tool.deleted": "Die {id} deleted.",
    "tool.deleteFailed": "Failed to delete die.",

    "dieInfo.heading": "KONNEKT INDIA PVT. LTD.",
    "dieInfo.projectNameLabel": "Project Name :-",
    "dieInfo.projectIdLabel": "Project ID :-",
    "dieInfo.startDateLabel": "Project Start Date:-",
    "dieInfo.typeLabel": "Type Of Project:-",
    "dieInfo.notSet": "—",

    "parts.heading": "Add / Edit Parts",
    "parts.selectDie": "Select Die",
    "parts.thPartId": "Part ID",
    "parts.thPlate": "Plate",
    "parts.thMaterial": "Material",
    "parts.thRoughSize": "Rough Size",
    "parts.thQty": "Qty",
    "parts.addPlatesHeading": "Add Plates",
    "parts.addToListButton": "Add to list",
    "parts.addPlatesButton": "Add Selected Plates",
    "parts.selectAtLeastOnePlate": "Check at least one plate, or add a custom name, first.",
    "parts.platesAddedMsg": "Added {count} plate(s).",
    "parts.platesAddFailed": "Failed to add plates.",
    "parts.partsTableHeading": "Parts",
    "parts.saveAllButton": "Save All",
    "parts.savedAllMsg": "Saved all changes.",
    "parts.saveAllFailed": "Failed to save.",
    "parts.plateLabel": "Plate",
    "parts.plateOtherLabel": "Plate Name (Other)",
    "parts.plateOtherPlaceholder": "Type plate name",
    "parts.partIdLabel": "Part ID",
    "parts.partIdPlaceholder": "leave blank to auto-generate",
    "parts.materialLabel": "Material",
    "parts.materialPlaceholder": "e.g. D2",
    "parts.roughSizeLabel": "Rough Size",
    "parts.roughSizePlaceholder": "e.g. 32X155X185",
    "parts.qtyLabel": "Qty",
    "parts.addButton": "Add Part",
    "parts.cancelButton": "Cancel",
    "parts.updateButton": "Update {id}",
    "parts.none": "No parts added yet.",
    "parts.edit": "Edit",
    "parts.delete": "Delete",
    "parts.deleteConfirm": "Delete part {id}? This also removes its tracking entries.",
    "parts.deleted": "Deleted {id}.",
    "parts.deleteFailed": "Failed to delete part.",
    "parts.saveFailed": "Failed to save part.",
    "parts.added": "Added {id} — {name}.",
    "parts.updated": "Updated {id} — {name}.",
    "parts.pickOther": "Pick a plate or type a name for Other.",
    "parts.addDieFirst": "Add a die above first.",

    "childParts.heading": "Child Parts",
    "childParts.hint": "Upload one CSV or Excel file for the selected die above — first row must be a header, columns: Child Part Name, Qty.",
    "childParts.uploadButton": "Upload CSV/Excel",
    "childParts.saveButton": "Save Child Parts",
    "childParts.thChildName": "Child Part",
    "childParts.thQty": "Qty",
    "childParts.none": "No child parts uploaded yet.",
    "childParts.uploadedMsg": "Added {count} row(s) from the file — review below, then Save Child Parts.",
    "childParts.uploadFailed": "Failed to import child parts.",
    "childParts.selectDieFirst": "Select a die above first.",
    "childParts.savedMsg": "Saved {count} child part(s).",
    "childParts.saveFailed": "Failed to save child parts.",

    "schedule.heading": "Project Schedule (Plan)",
    "schedule.addOtherHeading": "Add Other Activity",
    "schedule.otherLabel": "Activity Name (Other)",
    "schedule.otherPlaceholder": "Type activity name",
    "schedule.addToListButton": "Add to list",
    "schedule.addSelectedButton": "Add Activity",
    "schedule.typeActivityNameFirst": "Type a custom activity name and add it to the list first.",
    "schedule.activitiesAddedMsg": "Added {count} activity(ies).",
    "schedule.activitiesAddFailed": "Failed to add activities.",
    "schedule.addDieFirst": "Add a die above first.",
    "schedule.toolRoomDivider": "Tool Room",
    "schedule.tableHeading": "Schedule",
    "schedule.rangeStartLabel": "Plan From:",
    "schedule.rangeEndLabel": "Plan To:",
    "schedule.generateButton": "Generate",
    "schedule.rangeInvalid": "\"Plan To\" date must be on or after \"Plan From\" date.",
    "schedule.rangeAllSundays": "Selected range has no working days (Sundays are skipped) — pick a different range.",
    "schedule.generateFailed": "Failed to generate the schedule table.",
    "schedule.generateFirst": "Pick a date range and press Generate first.",
    "schedule.thSrNo": "Sr. No.",
    "schedule.thActivity": "Activity",
    "schedule.thTodayPlan": "Plan (P)",
    "schedule.saveAllButton": "Save All",
    "schedule.savedAllMsg": "Saved.",
    "schedule.saveAllFailed": "Failed to save.",
    "schedule.none": "No schedule activities added yet.",
    "schedule.delete": "Delete",
    "schedule.deleteConfirm": "Delete this schedule activity?",
    "schedule.deleted": "Deleted.",
    "schedule.deleteFailed": "Failed to delete activity.",

    "dieStatus.heading": "Die Status",
    "dieStatus.selectDie": "Select Die",
    "dieStatus.selectDieFirst": "Select a die above to see its parts.",
    "dieStatus.thPlate": "Plate",
    "dieStatus.thPartId": "Part ID",
    "dieStatus.thDesignReady": "Design Ready",
    "dieStatus.thCodeReady": "Code Ready",
    "dieStatus.none": "This die has no parts yet.",
    "dieStatus.updateFailed": "Failed to update status.",

    "newToolSubtab.add": "Add a New Die",
    "newToolSubtab.edit": "Edit Existing Die",
    "newToolSubtab.selectDieToEdit": "-- Select a Die --",

    "employees.heading": "Manage Employees",
    "employees.listHeading": "Employees",
    "employees.nameLabel": "Employee Name",
    "employees.shiftLabel": "Shift",
    "employees.machineLabel": "Machine",
    "employees.machineOtherLabel": "Machine Name (Other)",
    "employees.machineOtherPlaceholder": "Type machine/department name",
    "employees.addButton": "Add Employee",
    "employees.cancelButton": "Cancel",
    "employees.updateButton": "Update {name}",
    "employees.thName": "Name",
    "employees.thMachine": "Machine",
    "employees.thShift": "Shift",
    "employees.none": "No employees added yet.",
    "employees.edit": "Edit",
    "employees.delete": "Delete",
    "employees.pickMachineOther": "Pick a machine or type a name for Other.",
    "employees.deleteConfirm": "Delete employee {name}?",
    "employees.deleted": "Deleted {name}.",
    "employees.deleteFailed": "Failed to delete employee.",
    "employees.saveFailed": "Failed to save employee.",
    "employees.added": "Added {name}.",
    "employees.updated": "Updated {name}.",

    "entrySubtab.selectTitle": "Select Option",
    "entrySubtab.add": "Add Entry",
    "entrySubtab.progress": "Work Progress",

    "common.other": "Other…",
    "common.saving": "Saving…",
    "common.clearing": "Clearing…",
    "common.refreshing": "Refreshing…",

    "wizard.home": "🏠 Home",
    "wizard.previous": "◀ Previous",
    "wizard.next": "Next ▶",
    "wizard.selectMachine": "Select Machine",
    "wizard.deptNameLabel": "Department Name",
    "wizard.deptNamePlaceholder": "Type department name",
    "wizard.continue": "Continue ▶",
    "wizard.selectDiePrefix": "Select Die — ",
    "wizard.partHeading": "Part",
    "wizard.employeeHeading": "Employee",
    "wizard.startButton": "Start",
    "wizard.noDiesAdd": "No dies yet — add one in \"New Die / Add Parts\".",
    "wizard.noParts": "No parts added yet.",
    "wizard.noEmployeesAssigned": "No employees assigned to {stage} yet — add one in \"New Die / Add Parts\".",
    "wizard.started": "Started {part} at {stage} for {operator}.",
    "wizard.startFailed": "Failed to start.",
    "wizard.doneHere": "Done here",
    "wizard.workingHere": "Working here",
    "wizard.waitingHere": "Waiting here",
    "wizard.workingElsewhere": "Working elsewhere",
    "wizard.pending": "Pending",

    "entries.heading": "Entries",
    "entries.refresh": "Refresh",
    "entries.reset": "Reset All Entries (start fresh)",
    "entries.resetConfirm": "Reset ALL entries? This clears every Start/Stop tracking record so every part goes back to Pending. Your Dies and Parts are NOT affected.",
    "entries.resetDone": "Cleared {count} entries. All parts are Pending again.",
    "entries.resetFailed": "Failed to reset entries.",
    "entries.none": "No entries yet.",
    "entries.noneFiltered": "No running task — {employee} has nothing open in {stage}.",
    "entries.thDieId": "Project ID",
    "entries.thPartId": "Part ID",
    "entries.thDieName": "Die Name",
    "entries.thPartName": "Part Name",
    "entries.thDepartment": "Department",
    "entries.thOperator": "Operator",
    "entries.thStartDate": "Start Date",
    "entries.thStartTime": "Start Time",
    "entries.thEndDate": "End Date",
    "entries.thEndTime": "End Time",
    "entries.thShift": "Shift",
    "entries.thStatus": "Status",
    "entries.statusWorking": "Working",
    "entries.statusWaiting": "Waiting",
    "entries.statusDone": "Done",
    "entries.stop": "Stop",
    "entries.restart": "Restart",
    "entries.doneMsg": "{part} marked Done.",
    "entries.waitingMsg": "{part} marked Waiting.",
    "entries.stopFailed": "Failed to stop.",
    "entries.resumedMsg": "{part} resumed.",
    "entries.restartFailed": "Failed to restart.",

    "wp.selectEmployeePrefix": "Select Employee — ",
    "wp.view": "View",
    "wp.noEmployeesAssigned": "No employees assigned to {stage} — add one in \"New Die / Add Parts\".",

    "popover.taskCompleted": "Task Completed?",
    "popover.yes": "Y",
    "popover.no": "N",

    "track.heading": "Track a Die",
    "track.dieIdLabel": "Project ID",
    "track.showStatus": "Show Status",
    "track.dieNotFound": "Die not found.",
    "track.thPartId": "Part ID",
    "track.thPartName": "Part Name",
    "track.none": "No parts added yet.",
    "track.statusRunning": "Running",
    "track.statusWaiting": "Waiting",
    "track.statusCompleted": "Completed",
    "track.statusPending": "Pending",
    "track.startedAt": "Started {time}{who}",
    "track.startedWaiting": "Started {time}{who} — waiting on completion",
    "track.by": " by {who}",
    "track.statusOutsource": "OutSource",

    "outsource.heading": "Send Part for OutSource",
    "outsource.selectDie": "Select Die",
    "outsource.selectPart": "Select Part",
    "outsource.processLabel": "Process",
    "outsource.processPlaceholder": "e.g. Plating",
    "outsource.placeLabel": "Place",
    "outsource.placePlaceholder": "e.g. ABC Plating Works",
    "outsource.durationLabel": "Estimated Duration",
    "outsource.durationPlaceholder": "e.g. 7 days",
    "outsource.addButton": "Add Entry",
    "outsource.tableHeading": "OutSource Entries",
    "outsource.thProcess": "Process",
    "outsource.thPlace": "Place",
    "outsource.thDuration": "Duration",
    "outsource.noParts": "No parts on this die yet.",
    "outsource.selectDiePartFirst": "Select a Die and Part first.",
    "outsource.addedMsg": "Sent {part} for OutSource.",
    "outsource.addFailed": "Failed to add OutSource entry.",
    "outsource.none": "No OutSource entries yet.",
    "outsource.noneOpen": "No parts currently OutSource.",
    "outsource.markReturned": "Mark Returned",
    "outsource.returnFailed": "Failed to mark returned.",

    "errors.loadFailed": "Could not load data.",
    "errors.refreshFailed": "Could not refresh — check the internet connection.",
  },

  hi: {
    "app.title": "कोलर्स — डाई / टूल ट्रैकिंग",
    "nav.newDie": "नई डाई / पार्ट्स जोड़ें",
    "nav.entry": "एंट्री",
    "nav.track": "डाई ट्रैक करें",

    "role.title": "लॉगिन प्रकार चुनें",
    "role.admin": "एडमिन",
    "role.workshop": "वर्कशॉप",
    "role.back": "◀ वापस",
    "role.logout": "लॉगआउट",

    "workshopLogin.title": "वर्कशॉप लॉगिन",

    "login.title": "एडमिन लॉगिन",
    "login.idLabel": "लॉगिन आईडी",
    "login.idPlaceholder": "लॉगिन आईडी",
    "login.passwordLabel": "पासवर्ड",
    "login.passwordPlaceholder": "पासवर्ड",
    "login.button": "लॉगिन",
    "login.checking": "जाँच हो रही है…",
    "login.error": "गलत लॉगिन आईडी या पासवर्ड।",
    "login.offlineError": "लॉगिन जाँच नहीं हो सकी — इंटरनेट नहीं है क्या?",

    "tool.heading": "नई डाई जोड़ें",
    "tool.idLabel": "प्रोजेक्ट आईडी",
    "tool.idPlaceholder": "जैसे PT-170",
    "tool.descLabel": "विवरण",
    "tool.descPlaceholder": "जैसे KLICK SPN Plastic Door 4 Way Knockout Tool",
    "tool.productLabel": "प्रोडक्ट का नाम",
    "tool.productPlaceholder": "वैकल्पिक",
    "tool.typeOfProjectLabel": "प्रोजेक्ट का प्रकार",
    "tool.projectStartDateLabel": "प्रोजेक्ट शुरू होने की तारीख",
    "tool.addButton": "डाई जोड़ें",
    "tool.added": "डाई {id} जोड़ी गई।",
    "tool.addFailed": "डाई जोड़ने में विफल।",
    "tool.noDiesAddAbove": "अभी कोई डाई नहीं — ऊपर एक जोड़ें",
    "tool.noDies": "अभी कोई डाई नहीं",
    "tool.editButton": "डाई संपादित करें",
    "tool.deleteButton": "डाई हटाएं",
    "tool.saveButton": "सेव करें",
    "tool.cancelButton": "रद्द करें",
    "tool.selectDieFirst": "पहले ऊपर एक डाई चुनें।",
    "tool.updated": "डाई {id} अपडेट हुई।",
    "tool.updateFailed": "डाई अपडेट करने में विफल।",
    "tool.deleteConfirm": "डाई {id} हटाएं? इससे इसके सभी पार्ट्स, ऑपरेशन हिस्ट्री, आउटसोर्स एंट्रीज़ और चाइल्ड पार्ट्स भी हट जाएंगे।",
    "tool.deleted": "डाई {id} हटाई गई।",
    "tool.deleteFailed": "डाई हटाने में विफल।",

    "dieInfo.heading": "KONNEKT INDIA PVT. LTD.",
    "dieInfo.projectNameLabel": "प्रोजेक्ट का नाम :-",
    "dieInfo.projectIdLabel": "प्रोजेक्ट आईडी :-",
    "dieInfo.startDateLabel": "प्रोजेक्ट शुरू होने की तारीख:-",
    "dieInfo.typeLabel": "प्रोजेक्ट का प्रकार:-",
    "dieInfo.notSet": "—",

    "parts.heading": "पार्ट्स जोड़ें / बदलें",
    "parts.selectDie": "डाई चुनें",
    "parts.thPartId": "पार्ट आईडी",
    "parts.thPlate": "प्लेट",
    "parts.thMaterial": "मटेरियल",
    "parts.thRoughSize": "रफ साइज़",
    "parts.thQty": "मात्रा",
    "parts.addPlatesHeading": "प्लेट्स जोड़ें",
    "parts.addToListButton": "सूची में जोड़ें",
    "parts.addPlatesButton": "चुनी हुई प्लेट्स जोड़ें",
    "parts.selectAtLeastOnePlate": "पहले कम से कम एक प्लेट चुनें, या एक कस्टम नाम जोड़ें।",
    "parts.platesAddedMsg": "{count} प्लेट(स) जोड़ी गईं।",
    "parts.platesAddFailed": "प्लेट्स जोड़ने में विफल।",
    "parts.partsTableHeading": "पार्ट्स",
    "parts.saveAllButton": "सभी सेव करें",
    "parts.savedAllMsg": "सभी बदलाव सेव हुए।",
    "parts.saveAllFailed": "सेव करने में विफल।",
    "parts.plateLabel": "प्लेट",
    "parts.plateOtherLabel": "प्लेट का नाम (अन्य)",
    "parts.plateOtherPlaceholder": "प्लेट का नाम लिखें",
    "parts.partIdLabel": "पार्ट आईडी",
    "parts.partIdPlaceholder": "खाली छोड़ें तो अपने आप बन जाएगा",
    "parts.materialLabel": "मटेरियल",
    "parts.materialPlaceholder": "जैसे D2",
    "parts.roughSizeLabel": "रफ साइज़",
    "parts.roughSizePlaceholder": "जैसे 32X155X185",
    "parts.qtyLabel": "मात्रा",
    "parts.addButton": "पार्ट जोड़ें",
    "parts.cancelButton": "रद्द करें",
    "parts.updateButton": "{id} अपडेट करें",
    "parts.none": "अभी कोई पार्ट नहीं जोड़ा गया।",
    "parts.edit": "बदलें",
    "parts.delete": "हटाएं",
    "parts.deleteConfirm": "पार्ट {id} हटाएं? इससे इसकी ट्रैकिंग एंट्रीज़ भी हट जाएंगी।",
    "parts.deleted": "{id} हटाया गया।",
    "parts.deleteFailed": "पार्ट हटाने में विफल।",
    "parts.saveFailed": "पार्ट सेव करने में विफल।",
    "parts.added": "{id} — {name} जोड़ा गया।",
    "parts.updated": "{id} — {name} अपडेट हुआ।",
    "parts.pickOther": "एक प्लेट चुनें या 'अन्य' के लिए नाम लिखें।",
    "parts.addDieFirst": "पहले ऊपर एक डाई जोड़ें।",

    "childParts.heading": "चाइल्ड पार्ट्स",
    "childParts.hint": "ऊपर चुनी गई डाई के लिए एक CSV या Excel फ़ाइल अपलोड करें — पहली पंक्ति हेडर होनी चाहिए, कॉलम: चाइल्ड पार्ट नाम, मात्रा।",
    "childParts.uploadButton": "CSV/Excel अपलोड करें",
    "childParts.saveButton": "चाइल्ड पार्ट्स सेव करें",
    "childParts.thChildName": "चाइल्ड पार्ट",
    "childParts.thQty": "मात्रा",
    "childParts.none": "अभी कोई चाइल्ड पार्ट अपलोड नहीं हुआ।",
    "childParts.uploadedMsg": "फ़ाइल से {count} पंक्तियाँ जोड़ी गईं — नीचे जांचें, फिर चाइल्ड पार्ट्स सेव करें दबाएं।",
    "childParts.uploadFailed": "चाइल्ड पार्ट्स आयात करने में विफल।",
    "childParts.selectDieFirst": "पहले ऊपर एक डाई चुनें।",
    "childParts.savedMsg": "{count} चाइल्ड पार्ट सेव हुए।",
    "childParts.saveFailed": "चाइल्ड पार्ट्स सेव करने में विफल।",

    "schedule.heading": "प्रोजेक्ट शेड्यूल (प्लान)",
    "schedule.addOtherHeading": "अन्य गतिविधि जोड़ें",
    "schedule.otherLabel": "गतिविधि का नाम (अन्य)",
    "schedule.otherPlaceholder": "गतिविधि का नाम लिखें",
    "schedule.addToListButton": "सूची में जोड़ें",
    "schedule.addSelectedButton": "गतिविधि जोड़ें",
    "schedule.typeActivityNameFirst": "पहले एक कस्टम गतिविधि का नाम लिखें और सूची में जोड़ें।",
    "schedule.activitiesAddedMsg": "{count} गतिविधि(याँ) जोड़ी गईं।",
    "schedule.activitiesAddFailed": "गतिविधियाँ जोड़ने में विफल।",
    "schedule.addDieFirst": "पहले ऊपर एक डाई जोड़ें।",
    "schedule.toolRoomDivider": "टूल रूम",
    "schedule.tableHeading": "शेड्यूल",
    "schedule.rangeStartLabel": "प्लान From:",
    "schedule.rangeEndLabel": "प्लान To:",
    "schedule.generateButton": "जेनरेट करें",
    "schedule.rangeInvalid": "\"प्लान To\" तारीख़ \"प्लान From\" तारीख़ के बराबर या बाद की होनी चाहिए।",
    "schedule.rangeAllSundays": "चुनी गई रेंज में कोई कार्य दिवस नहीं है (रविवार छोड़ दिए जाते हैं) — कोई अलग रेंज चुनें।",
    "schedule.generateFailed": "शेड्यूल टेबल जेनरेट करने में विफल।",
    "schedule.generateFirst": "पहले तारीख़ रेंज चुनें और जेनरेट पर क्लिक करें।",
    "schedule.thSrNo": "क्र.सं.",
    "schedule.thActivity": "गतिविधि",
    "schedule.thTodayPlan": "प्लान (P)",
    "schedule.saveAllButton": "सभी सेव करें",
    "schedule.savedAllMsg": "सेव हुआ।",
    "schedule.saveAllFailed": "सेव करने में विफल।",
    "schedule.none": "अभी कोई शेड्यूल गतिविधि नहीं जोड़ी गई।",
    "schedule.delete": "हटाएं",
    "schedule.deleteConfirm": "यह शेड्यूल गतिविधि हटाएं?",
    "schedule.deleted": "हटाया गया।",
    "schedule.deleteFailed": "गतिविधि हटाने में विफल।",

    "dieStatus.heading": "डाई स्थिति",
    "dieStatus.selectDie": "डाई चुनें",
    "dieStatus.selectDieFirst": "इसके पार्ट्स देखने के लिए ऊपर एक डाई चुनें।",
    "dieStatus.thPlate": "प्लेट",
    "dieStatus.thPartId": "पार्ट आईडी",
    "dieStatus.thDesignReady": "डिज़ाइन तैयार",
    "dieStatus.thCodeReady": "कोड तैयार",
    "dieStatus.none": "इस डाई में अभी कोई पार्ट नहीं है।",
    "dieStatus.updateFailed": "स्थिति अपडेट करने में विफल।",

    "newToolSubtab.add": "नई डाई जोड़ें",
    "newToolSubtab.edit": "मौजूदा डाई संपादित करें",
    "newToolSubtab.selectDieToEdit": "-- एक डाई चुनें --",

    "employees.heading": "कर्मचारी प्रबंधन",
    "employees.listHeading": "कर्मचारी सूची",
    "employees.nameLabel": "कर्मचारी का नाम",
    "employees.shiftLabel": "शिफ्ट",
    "employees.machineLabel": "मशीन",
    "employees.machineOtherLabel": "मशीन का नाम (अन्य)",
    "employees.machineOtherPlaceholder": "मशीन/विभाग का नाम लिखें",
    "employees.addButton": "कर्मचारी जोड़ें",
    "employees.cancelButton": "रद्द करें",
    "employees.updateButton": "{name} अपडेट करें",
    "employees.thName": "नाम",
    "employees.thMachine": "मशीन",
    "employees.thShift": "शिफ्ट",
    "employees.none": "अभी कोई कर्मचारी नहीं जोड़ा गया।",
    "employees.edit": "बदलें",
    "employees.delete": "हटाएं",
    "employees.pickMachineOther": "एक मशीन चुनें या 'अन्य' के लिए नाम लिखें।",
    "employees.deleteConfirm": "कर्मचारी {name} हटाएं?",
    "employees.deleted": "{name} हटाया गया।",
    "employees.deleteFailed": "कर्मचारी हटाने में विफल।",
    "employees.saveFailed": "कर्मचारी सेव करने में विफल।",
    "employees.added": "{name} जोड़ा गया।",
    "employees.updated": "{name} अपडेट हुआ।",

    "entrySubtab.selectTitle": "विकल्प चुनें",
    "entrySubtab.add": "एंट्री जोड़ें",
    "entrySubtab.progress": "काम की प्रगति",

    "common.other": "अन्य…",
    "common.saving": "सेव हो रहा है…",
    "common.clearing": "साफ़ हो रहा है…",
    "common.refreshing": "रिफ्रेश हो रहा है…",

    "wizard.home": "🏠 होम",
    "wizard.previous": "◀ पिछला",
    "wizard.next": "अगला ▶",
    "wizard.selectMachine": "मशीन चुनें",
    "wizard.deptNameLabel": "विभाग का नाम",
    "wizard.deptNamePlaceholder": "विभाग का नाम लिखें",
    "wizard.continue": "जारी रखें ▶",
    "wizard.selectDiePrefix": "डाई चुनें — ",
    "wizard.partHeading": "पार्ट",
    "wizard.employeeHeading": "कर्मचारी",
    "wizard.startButton": "शुरू करें",
    "wizard.noDiesAdd": "अभी कोई डाई नहीं — \"नई डाई / पार्ट्स जोड़ें\" में एक जोड़ें।",
    "wizard.noParts": "अभी कोई पार्ट नहीं जोड़ा गया।",
    "wizard.noEmployeesAssigned": "{stage} में अभी कोई कर्मचारी नहीं — \"नई डाई / पार्ट्स जोड़ें\" में एक जोड़ें।",
    "wizard.started": "{part} को {stage} पर {operator} के लिए शुरू किया गया।",
    "wizard.startFailed": "शुरू करने में विफल।",
    "wizard.doneHere": "यहाँ पूर्ण",
    "wizard.workingHere": "यहाँ चल रहा है",
    "wizard.waitingHere": "यहाँ प्रतीक्षा में",
    "wizard.workingElsewhere": "कहीं और चल रहा है",
    "wizard.pending": "लंबित",

    "entries.heading": "एंट्रीज़",
    "entries.refresh": "रिफ्रेश करें",
    "entries.reset": "सभी एंट्रीज़ रीसेट करें (नए सिरे से शुरू करें)",
    "entries.resetConfirm": "सभी एंट्रीज़ रीसेट करें? इससे हर स्टार्ट/स्टॉप ट्रैकिंग रिकॉर्ड मिट जाएगा और हर पार्ट फिर से लंबित हो जाएगा। आपकी डाई और पार्ट्स प्रभावित नहीं होंगे।",
    "entries.resetDone": "{count} एंट्रीज़ साफ़ कीं। सभी पार्ट्स फिर से लंबित हैं।",
    "entries.resetFailed": "एंट्रीज़ रीसेट करने में विफल।",
    "entries.none": "अभी कोई एंट्री नहीं।",
    "entries.noneFiltered": "कोई चल रहा काम नहीं — {employee} के पास {stage} में कुछ भी खुला नहीं है।",
    "entries.thDieId": "प्रोजेक्ट आईडी",
    "entries.thPartId": "पार्ट आईडी",
    "entries.thDieName": "डाई का नाम",
    "entries.thPartName": "पार्ट का नाम",
    "entries.thDepartment": "विभाग",
    "entries.thOperator": "ऑपरेटर",
    "entries.thStartDate": "शुरू तारीख",
    "entries.thStartTime": "शुरू समय",
    "entries.thEndDate": "समाप्ति तारीख",
    "entries.thEndTime": "समाप्ति समय",
    "entries.thShift": "शिफ्ट",
    "entries.thStatus": "स्थिति",
    "entries.statusWorking": "चल रहा है",
    "entries.statusWaiting": "प्रतीक्षा में",
    "entries.statusDone": "पूर्ण",
    "entries.stop": "रोकें",
    "entries.restart": "फिर शुरू करें",
    "entries.doneMsg": "{part} पूर्ण के रूप में चिह्नित।",
    "entries.waitingMsg": "{part} प्रतीक्षा में चिह्नित।",
    "entries.stopFailed": "रोकने में विफल।",
    "entries.resumedMsg": "{part} फिर शुरू किया गया।",
    "entries.restartFailed": "फिर शुरू करने में विफल।",

    "wp.selectEmployeePrefix": "कर्मचारी चुनें — ",
    "wp.view": "देखें",
    "wp.noEmployeesAssigned": "{stage} में कोई कर्मचारी नहीं — \"नई डाई / पार्ट्स जोड़ें\" में एक जोड़ें।",

    "popover.taskCompleted": "क्या काम पूरा हुआ?",
    "popover.yes": "हाँ",
    "popover.no": "नहीं",

    "track.heading": "डाई ट्रैक करें",
    "track.dieIdLabel": "प्रोजेक्ट आईडी",
    "track.showStatus": "स्थिति दिखाएं",
    "track.dieNotFound": "डाई नहीं मिली।",
    "track.thPartId": "पार्ट आईडी",
    "track.thPartName": "पार्ट का नाम",
    "track.none": "अभी कोई पार्ट नहीं जोड़ा गया।",
    "track.statusRunning": "चल रहा है",
    "track.statusWaiting": "प्रतीक्षा में",
    "track.statusCompleted": "पूर्ण",
    "track.statusPending": "लंबित",
    "track.startedAt": "{time}{who} पर शुरू हुआ",
    "track.startedWaiting": "{time}{who} पर शुरू हुआ — पूर्णता की प्रतीक्षा में",
    "track.by": " {who} द्वारा",
    "track.statusOutsource": "आउटसोर्स",

    "outsource.heading": "पार्ट आउटसोर्स के लिए भेजें",
    "outsource.selectDie": "डाई चुनें",
    "outsource.selectPart": "पार्ट चुनें",
    "outsource.processLabel": "प्रोसेस",
    "outsource.processPlaceholder": "जैसे प्लेटिंग",
    "outsource.placeLabel": "स्थान",
    "outsource.placePlaceholder": "जैसे ABC प्लेटिंग वर्क्स",
    "outsource.durationLabel": "अनुमानित समय",
    "outsource.durationPlaceholder": "जैसे 7 दिन",
    "outsource.addButton": "एंट्री जोड़ें",
    "outsource.tableHeading": "आउटसोर्स एंट्रीज़",
    "outsource.thProcess": "प्रोसेस",
    "outsource.thPlace": "स्थान",
    "outsource.thDuration": "अवधि",
    "outsource.noParts": "इस डाई में अभी कोई पार्ट नहीं।",
    "outsource.selectDiePartFirst": "पहले एक डाई और पार्ट चुनें।",
    "outsource.addedMsg": "{part} आउटसोर्स के लिए भेजा गया।",
    "outsource.addFailed": "आउटसोर्स एंट्री जोड़ने में विफल।",
    "outsource.none": "अभी कोई आउटसोर्स एंट्री नहीं।",
    "outsource.noneOpen": "अभी कोई पार्ट आउटसोर्स में नहीं है।",
    "outsource.markReturned": "वापसी दर्ज करें",
    "outsource.returnFailed": "वापसी दर्ज करने में विफल।",

    "errors.loadFailed": "डेटा लोड नहीं हो सका।",
    "errors.refreshFailed": "रिफ्रेश नहीं हो सका — इंटरनेट कनेक्शन जांचें।",
  },
};

let currentLang = (() => {
  try {
    return localStorage.getItem("kolors_lang") || "en";
  } catch (_) {
    return "en";
  }
})();

function t(key, params) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  let str = (dict && dict[key]) ?? TRANSLATIONS.en[key] ?? key;
  if (params) {
    Object.keys(params).forEach((k) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
    });
  }
  return str;
}

function setStoredLanguage(lang) {
  currentLang = lang;
  try {
    localStorage.setItem("kolors_lang", lang);
  } catch (_) { /* private-browsing etc. — language just won't persist */ }
}

// ---------- automatic transliteration (English -> Devanagari) ----------
// Used for worker names and custom ("Other…") machine names, which have no
// curated translation (unlike the 9 fixed STAGES above). A dictionary of
// common Indian first names/surnames is checked first, word by word,
// case-insensitively, for accuracy; anything not in it falls through to a
// best-effort phonetic converter. Roman spelling is inherently ambiguous for
// Hindi (e.g. "Priya" could be "प्रिया" or "प्रिय"), so this is an
// approximation meant to make a name *readable* to a Hindi speaker — not a
// guarantee of the one "correct" spelling every time.
const COMMON_NAME_HI = {
  ram: "राम", shyam: "श्याम", mohan: "मोहन", sohan: "सोहन", suresh: "सुरेश",
  ramesh: "रमेश", rajesh: "राजेश", mahesh: "महेश", naresh: "नरेश", dinesh: "दिनेश",
  rakesh: "राकेश", umesh: "उमेश", hitesh: "हितेश", nitesh: "नितेश", lokesh: "लोकेश",
  yogesh: "योगेश", mukesh: "मुकेश", vikas: "विकास", vikram: "विक्रम", vijay: "विजय",
  ajay: "अजय", sanjay: "संजय", amit: "अमित", sumit: "सुमित", rohit: "रोहित",
  mohit: "मोहित", ankit: "अंकित", ranjit: "रणजीत", ajit: "अजीत", sumeet: "सुमीत",
  anil: "अनिल", sunil: "सुनील", kapil: "कपिल", nikhil: "निखिल", akhil: "अखिल",
  rahul: "राहुल", rohan: "रोहन", karan: "करण", arjun: "अर्जुन", arun: "अरुण",
  varun: "वरुण", tarun: "तरुण", deepak: "दीपक", ashok: "अशोक", vinod: "विनोद",
  pramod: "प्रमोद", manoj: "मनोज", sanjeev: "संजीव", rajeev: "राजीव", sandeep: "संदीप",
  pradeep: "प्रदीप", kuldeep: "कुलदीप", gurdeep: "गुरदीप", sameer: "समीर", naveen: "नवीन",
  praveen: "प्रवीण", kishore: "किशोर", yash: "यश", aman: "अमन", raman: "रमन",
  gaurav: "गौरव", saurabh: "सौरभ", vishal: "विशाल", nitin: "नितिन", sachin: "सचिन",
  sharad: "शरद", gopal: "गोपाल", kishan: "किशन", krishan: "कृष्ण", krishna: "कृष्ण",
  govind: "गोविंद", vinay: "विनय", jai: "जय", surendra: "सुरेंद्र", mahendra: "महेंद्र",
  devendra: "देवेंद्र", narendra: "नरेंद्र", rajendra: "राजेंद्र", jitendra: "जितेंद्र",
  virendra: "वीरेंद्र", upendra: "उपेंद्र", yogendra: "योगेंद्र", bhupendra: "भूपेंद्र",
  shailendra: "शैलेंद्र", harish: "हरीश", manish: "मनीष", girish: "गिरीश", satish: "सतीश",
  ashish: "आशीष", ravi: "रवि", raju: "राजू", raj: "राज", sunny: "सनी", vivek: "विवेक",
  alok: "आलोक", anand: "आनंद", balram: "बलराम", babu: "बाबू", prakash: "प्रकाश",
  santosh: "संतोष", brijesh: "ब्रजेश", rajkumar: "राजकुमार", ramkishan: "रामकिशन",
  omkar: "ओंकार", om: "ओम", shankar: "शंकर",
  kumar: "कुमार", suraj: "सूरज", gopi: "गोपी", hari: "हरि", balbir: "बलबीर",
  jagdish: "जगदीश", mukul: "मुकुल", pankaj: "पंकज", sushil: "सुशील", subhash: "सुभाष",
  dilip: "दिलीप", laxman: "लक्ष्मण", manohar: "मनोहर",
  sunita: "सुनीता", anita: "अनीता", geeta: "गीता", gita: "गीता", rita: "रीता",
  kavita: "कविता", savita: "सविता", lalita: "ललिता", babita: "बबीता", namita: "नमिता",
  sarita: "सरिता", vanita: "वनिता", priya: "प्रिया", divya: "दिव्या", pooja: "पूजा",
  puja: "पूजा", neha: "नेहा", nisha: "निशा", usha: "उषा", asha: "आशा", radha: "राधा",
  sudha: "सुधा", rekha: "रेखा", seema: "सीमा", reema: "रीमा", meena: "मीना",
  veena: "वीणा", leena: "लीना", deepa: "दीपा", shilpa: "शिल्पा", kalpana: "कल्पना",
  archana: "अर्चना", rachna: "रचना", sneha: "स्नेहा", suman: "सुमन", kiran: "किरण",
  jyoti: "ज्योति", aarti: "आरती", arti: "आरती", shanti: "शांति", shakti: "शक्ति",
  lata: "लता", mamta: "ममता", mamata: "ममता", pushpa: "पुष्पा", kamla: "कमला",
  kamlesh: "कमलेश", parth: "पार्थ", jigar: "जिगर", jigresh: "जिग्रेश",
  kamala: "कमला", sarla: "सरला", nirmala: "निर्मला", vimla: "विमला", sushma: "सुषमा",
  rashmi: "रश्मि", shalini: "शालिनी", ritu: "ऋतु", ruchi: "रुचि", preeti: "प्रीति",
  priti: "प्रीति", swati: "स्वाति", bharti: "भारती", pallavi: "पल्लवी", madhuri: "माधुरी",
  sarika: "सारिका", monika: "मोनिका", anjali: "अंजलि", anju: "अंजू", manju: "मंजू",
  renu: "रेनू", rani: "रानी", poonam: "पूनम", sonam: "सोनम", simran: "सिमरन",
  komal: "कोमल", payal: "पायल", uma: "उमा", sita: "सीता", gayatri: "गायत्री",
  saraswati: "सरस्वती", laxmi: "लक्ष्मी", lakshmi: "लक्ष्मी", durga: "दुर्गा",
  kavya: "काव्या", riya: "रिया", diya: "दिया", isha: "ईशा", tanvi: "तन्वी",
  tanu: "तनु", neetu: "नीतू", meenu: "मीनू",
  singh: "सिंह", sharma: "शर्मा", verma: "वर्मा", gupta: "गुप्ता", yadav: "यादव",
  patel: "पटेल", pandey: "पांडे", mishra: "मिश्रा", tiwari: "तिवारी", chauhan: "चौहान",
  rathore: "राठौर", thakur: "ठाकुर", shukla: "शुक्ला", saxena: "सक्सेना",
  agarwal: "अग्रवाल", jain: "जैन", khan: "खान", ansari: "अंसारी", das: "दास",
  dubey: "दुबे", prasad: "प्रसाद", rai: "राय", roy: "रॉय", nair: "नायर",
  reddy: "रेड्डी", naidu: "नायडू", iyer: "अय्यर", mehta: "मेहता", joshi: "जोशी",
  bhatt: "भट्ट", rawat: "रावत", bisht: "बिष्ट", negi: "नेगी", chandra: "चंद्र",
  lal: "लाल", devi: "देवी", begum: "बेगम",
  // Common shop-floor/process words — for custom ("Other…") machine names,
  // which are far more likely to be English process terms than Hindi names.
  cutting: "कटिंग", polishing: "पॉलिशिंग", buffing: "बफिंग", painting: "पेंटिंग",
  coating: "कोटिंग", powder: "पाउडर", packing: "पैकिंग", packaging: "पैकेजिंग",
  inspection: "इंस्पेक्शन", quality: "क्वालिटी", check: "चेक", deburring: "डिबरिंग",
  threading: "थ्रेडिंग", boring: "बोरिंग", marking: "मार्किंग", fitting: "फिटिंग",
  welding: "वेल्डिंग", drilling: "ड्रिलिंग", lapping: "लैपिंग", honing: "होनिंग",
  laser: "लेज़र", plating: "प्लेटिंग", blasting: "ब्लास्टिंग", sand: "सैंड",
  shot: "शॉट", finishing: "फिनिशिंग", machining: "मशीनिंग", department: "विभाग",
  section: "सेक्शन", line: "लाइन", unit: "यूनिट", store: "स्टोर", stores: "स्टोर्स",
  dispatch: "डिस्पैच", control: "कंट्रोल",
  band: "बैंड", saw: "सौ", bandsaw: "बैंड सौ", hack: "हैक", hacksaw: "हैक सौ",
  lathe: "लेथ", press: "प्रेस", punch: "पंच", shear: "शियर", bend: "बेंड",
  bending: "बेंडिंग", forming: "फॉर्मिंग", trimming: "ट्रिमिंग",
};

const TRANSLIT_CONSONANTS = [
  ["ksh", "क्ष"], ["chh", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"],
  ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["gy", "ज्ञ"],
  ["k", "क"], ["g", "ग"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"],
  ["p", "प"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"],
  ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"], ["z", "ज"],
  ["x", "क्स"], ["c", "क"],
];

const TRANSLIT_VOWELS = [
  ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"],
  ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];

// Best-effort phonetic Roman -> Devanagari conversion for one word (no
// spaces). Consonant clusters get a virama (्) between them, except a bare
// consonant at the very end of the word (matches normal Hindi spelling,
// where the final inherent vowel is simply not pronounced). A lone "n"/"m"
// immediately before another consonant reads more naturally as an anusvara
// (ं) than as a full conjunct, so that's special-cased.
function transliterateWord(word) {
  const lower = word.toLowerCase();
  const n = lower.length;
  let out = "";
  let i = 0;
  let pending = null;    // devanagari consonant not yet resolved
  let pendingRom = null; // the roman letter(s) that produced it

  while (i < n) {
    const ch = lower[i];
    if ("aeiou".indexOf(ch) !== -1) {
      let match = null;
      for (const v of TRANSLIT_VOWELS) {
        if (lower.startsWith(v[0], i)) { match = v; break; }
      }
      const [rom, indep, matra] = match;
      if (pending) {
        out += matra ? pending + matra : pending;
        pending = null; pendingRom = null;
      } else {
        out += indep;
      }
      i += rom.length;
      continue;
    }
    let match = null;
    for (const c of TRANSLIT_CONSONANTS) {
      if (lower.startsWith(c[0], i)) { match = c; break; }
    }
    if (!match) {
      if (pending) { out += pending; pending = null; pendingRom = null; }
      out += word[i];
      i++;
      continue;
    }
    const [rom, dev] = match;
    if (pending) {
      out += (pendingRom === "n" || pendingRom === "m") ? "ं" : pending + "्";
    }
    pending = dev;
    pendingRom = rom;
    i += rom.length;
  }
  if (pending) out += pending;
  return out;
}

// Transliterates every run of English letters in `text` (word by word via
// the dictionary first, then the phonetic fallback), leaving spaces,
// numbers, and punctuation untouched.
function transliterateToHindi(text) {
  if (!text) return text;
  return text.replace(/[A-Za-z]+/g, (word) => {
    const hit = COMMON_NAME_HI[word.toLowerCase()];
    return hit || transliterateWord(word);
  });
}
