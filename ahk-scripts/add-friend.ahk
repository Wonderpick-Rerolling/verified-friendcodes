#Requires AutoHotkey v2.0
#include OCR.ahk

; Create the GUI
MyGui := Gui()
MyGui.Title := "Pokemon Friend Code Filter"

; Add dropdown menu
ballTypes := ["all", "poke ball", "great ball", "ultra ball", "master ball", "vip"]
servers := ["Pokemon Pocket Hunters", "Wonderpick Rerolling"]
MyGui.Add("Text", "w200", "Select Minimum Ball Type:")
MyGui.Add("DropDownList", "vSelectedBall w200", ballTypes)
MyGui.Add("DropDownList", "vSelectedServer w200", servers)
MyGui["SelectedBall"].Text := "pokeball"
MyGui["SelectedServer"].Text := "Wonderpick Rerolling"

; Add button to fetch and filter data
MyGui.Add("Button", "Default w200", "Start Adding Friends").OnEvent("Click", Start)

; Add status text
statusText := MyGui.Add("Text", "w200", "Ready to load friend codes...")

; Show the GUI
MyGui.Show()

global winName := "4"

Start(*) {
    statusText.Value := "Loading friend codes..."
    LoadWhitelistedFriendCodes()
    statusText.Value := "Friend codes loaded. Starting to add friends..."

    Loop {
        ControlClick "x140 y515", winName
        Sleep 2000
        ControlClick "x140 y515", winName
        Sleep 2000
        ControlClick "x40 y468", winName
        Sleep 1000
        ControlClick "x247 y468", winName
        statusText.Value := "Searching for friend requests..."
        Sleep 500

        Loop {
            if (PixelGetColor(170, 190) = 0xEEF6F9) {

                statusText.Value := "Found, friend requests..."
                if (MyGui["SelectedBall"].Text = "all") {
                    ControlClick "x162, y180", winName ; default accept
                    Sleep 700
                    continue
                }

                ControlClick "x162 y180", winName
                Sleep 1000

                statusText.Value := "OCRing friendcode ..."
                ocrResult := OCR.FromWindow(winName,,2,{X:0, Y:0, W:500, H:100, onlyClientArea: 1})
                if (CheckFriendCode(Trim(ocrResult.Text))) {

                    statusText.Value := "User is whitelisted; Accepting friend request"
                    ; Accept friend request
                    ControlClick "x180 y412", winName
                    Sleep 500
                } else {
                    statusText.Value := "User is not whitelisted, or blacklisted. Rejecting friend request"
                    ; Delete friend request
                    ControlClick "x90 y412", winName
                    Sleep 500
                }

                ControlClick "x140 y500", winName
                Sleep 2000
            } else {
                statusText.Value := "No friend requests found, waiting 1 minute..."
                break
            }
        }

        Sleep 60000
    }
}

CheckFriendCode(friendCode) {
    friendCode := StrReplace(friendCode, "-", "")

    for code in BlacklistedFriendCodes {
        if (code = friendCode) {
            return false
        }
    }

    for code in FilteredFriendCodes {
        if (code = friendCode) {
            return true
        }
    }

    return false
}

LoadWhitelistedFriendCodes(*) {
    try {
        ; Download CSV file
        whr := ComObject("WinHttp.WinHttpRequest.5.1")

        minimumRole := StrReplace(MyGui["SelectedBall"].Text, " ", "%20")
        discordServer := StrReplace(MyGui["SelectedServer"].Text, " ", "%20")
        url := 'https://discord-bot.pokemonpockethunters.workers.dev/whitelist?minimum_role=' minimumRole '&discord_server=' discordServer
        whr.Open("GET", url, true)
        whr.Send()
        whr.WaitForResponse()
        friendCodesText := StrReplace(whr.ResponseText, "[", "")
        friendCodesText := StrReplace(friendCodesText, "]", "")
        friendCodesText := StrReplace(friendCodesText, '"', "")
        friendCodes := StrSplit(friendCodesText, ",")

        ; Update status with count of codes found
        statusText.Value := friendCodes.Length . " friend codes loaded"

        ; Store friend codes in a global variable for later use
        global FilteredFriendCodes := friendCodes

    } catch as err {
        statusText.Value := "Error: " . err.Message
    }
}

LoadBlacklistedFriendCodes(*) {
    try {
        ; Download CSV file
        whr := ComObject("WinHttp.WinHttpRequest.5.1")
        url := "https://raw.githubusercontent.com/Wonderpick-Rerolling/verified-friendcodes/refs/heads/main/blacklist.csv"
        whr.Open("GET", url, true)
        whr.Send()
        whr.WaitForResponse()
        csvData := whr.ResponseText

        ; Parse CSV and filter data
        friendCodes := []

        ; Split CSV into lines
        lines := StrSplit(csvData, "`n", "`r")

        ; Process each line
        firstLine := true
        for line in lines {
            ; Skip first line (header)
            if (firstLine) {
                firstLine := false
                continue
            }
            if (line = "") {
                continue
            }

            ; Split line into columns
            columns := StrSplit(line, ",")

            ; Check if we have enough columns
            if (columns.Length < 1) {
                continue
            }

            friendCodes.Push(Trim(columns[1]))
        }

        ; Store friend codes in a global variable for later use
        global BlacklistedFriendCodes := friendCodes

    } catch as err {
        statusText.Value := "Error: " . err.Message
    }
}

StringJoin(array, delimiter := ", ") {
    result := ""
    for item in array {
        result .= item . delimiter
    }
    ; Remove the trailing delimiter
    if (result != "") {
        result := SubStr(result, 1, -StrLen(delimiter))
    }
    return result
}

getRoleIndex(val) {
	Loop ballTypes.Length {
		if (ballTypes[A_Index] == val)
			return A_Index
	}
    return 0
}