#Requires AutoHotkey v2.0

; Create the GUI
MyGui := Gui()
MyGui.Title := "Pokemon Friend Code Filter"

; Add dropdown menu
ballTypes := ["all", "pokeball", "greatball", "ultraball", "masterball"]
MyGui.Add("DropDownList", "vSelectedBall w200", ballTypes)

; Add button to fetch and filter data
MyGui.Add("Button", "Default w200", "Load Friend Codes").OnEvent("Click", LoadFriendCodes)

; Add status text
statusText := MyGui.Add("Text", "w200", "Ready to load friend codes...")

; Show the GUI
MyGui.Show()

LoadFriendCodes(*) {
    try {
        ; Download CSV file
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        url := "https://raw.githubusercontent.com/Wonderpick-Rerolling/verified-friendcodes/refs/heads/main/pokemon-pocket-hunters/whitelist.csv"
        whr.Open("GET", url, true)
        whr.Send()
        whr.WaitForResponse()
        csvData := whr.ResponseText

        ; Parse CSV and filter data
        friendCodes := []
        selectedBall := MyGui["SelectedBall"].Text

        ; Split CSV into lines
        lines := StrSplit(csvData, "`n", "`r")

        ; Process each line
        for line in lines {
            if (line = "") {
                continue
            }

            ; Split line into columns
            columns := StrSplit(line, ",")

            ; Check if we have enough columns
            if (columns.Length < 2) {
                continue
            }

            ; Get role and friend code
            role := Trim(columns[1])
            friendCode := Trim(columns[2])

            ; Filter based on selected ball type
            if (selectedBall = "all" || role = selectedBall) {
                friendCodes.Push(friendCode)
            }
        }

        ; Update status with count of codes found
        statusText.Value := friendCodes.Length . " friend codes loaded"

        ; Store friend codes in a global variable for later use
        global FilteredFriendCodes := friendCodes

    } catch as err {
        statusText.Value := "Error: " . err.Message
    }
}