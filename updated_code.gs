var ALLOWED_EMAILS = ['pasionabe@gmail.com']

function doPost(e) {
  try {
    var payload = parsePayload_(e)
    var action = String(payload.action || '')

    if (!action) {
      return jsonResponse_({ ok: false, error: 'Missing action' })
    }

    var auth = requireAuthorizedUser_(payload)
    if (!auth.ok) {
      return jsonResponse_({ ok: false, error: auth.error })
    }

    switch (action) {
      case 'pollVote':
        return jsonResponse_(pollVote_(payload))

      case 'setBucketCompleted':
        return jsonResponse_(setBucketCompleted_(payload))

      case 'setCountryVisited':
        return jsonResponse_(setCountryVisited_(payload))

      case 'setCurrentStudyCompleted':
        return jsonResponse_(setCurrentStudyCompleted_(payload))

      case 'createPoll':
        return jsonResponse_(createPoll_(payload))

      case 'updatePoll':
        return jsonResponse_(updatePoll_(payload))

      case 'deletePoll':
        return jsonResponse_(deletePoll_(payload))

      case 'createBucketItem':
        return jsonResponse_(createBucketItem_(payload))

      case 'updateBucketItem':
        return jsonResponse_(updateBucketItem_(payload))

      case 'deleteBucketItem':
        return jsonResponse_(deleteBucketItem_(payload))

      case 'createCountry':
        return jsonResponse_(createCountry_(payload))

      case 'updateCountry':
        return jsonResponse_(updateCountry_(payload))

      case 'deleteCountry':
        return jsonResponse_(deleteCountry_(payload))

      default:
        return jsonResponse_({ ok: false, error: 'Unknown action: ' + action })
    }
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}

function parsePayload_(e) {
  var body = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}'
  return JSON.parse(body)
}

function requireAuthorizedUser_(payload) {
  var idToken = String(payload.idToken || '')
  if (!idToken) {
    return { ok: false, error: 'Invalid token' }
  }

  var tokenInfoUrl = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken)
  var response = UrlFetchApp.fetch(tokenInfoUrl, { muteHttpExceptions: true })
  if (response.getResponseCode() !== 200) {
    return { ok: false, error: 'Invalid token' }
  }

  var tokenInfo = JSON.parse(response.getContentText())
  var email = String(tokenInfo.email || '').toLowerCase().trim()
  if (!email) {
    return { ok: false, error: 'Invalid token' }
  }

  if (!isAllowedEmail_(email)) {
    return { ok: false, error: 'Unauthorized account' }
  }

  return { ok: true, email: email }
}

function isAllowedEmail_(email) {
  for (var i = 0; i < ALLOWED_EMAILS.length; i += 1) {
    if (String(ALLOWED_EMAILS[i]).toLowerCase().trim() === email) {
      return true
    }
  }
  return false
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

function nowIso_() {
  return Utilities.formatDate(new Date(), 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'")
}

function toBoolean_(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  var s = String(value || '').toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties()
  var spreadsheetId = String(props.getProperty('SPREADSHEET_ID') || '').trim()

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId)
  }

  return SpreadsheetApp.getActiveSpreadsheet()
}

function getSheet_(name) {
  var ss = getSpreadsheet_()
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    throw new Error('Missing sheet: ' + name)
  }
  return sheet
}

function headerMap_(sheet) {
  var width = Math.max(1, sheet.getLastColumn())
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0]
  var map = {}
  for (var i = 0; i < headers.length; i += 1) {
    map[String(headers[i]).trim()] = i + 1
  }
  return map
}

function requireHeader_(map, name) {
  var col = map[name]
  if (!col) {
    throw new Error('Missing required column: ' + name)
  }
  return col
}

function findRowById_(sheet, idCol, idValue) {
  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1

  var values = sheet.getRange(2, idCol, lastRow - 1, 1).getValues()
  var target = String(idValue)

  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === target) {
      return i + 2
    }
  }

  return -1
}

function appendByHeaders_(sheet, headerCols, record) {
  var width = sheet.getLastColumn()
  var row = new Array(width)

  for (var i = 0; i < width; i += 1) row[i] = ''

  for (var key in record) {
    if (!record.hasOwnProperty(key)) continue
    var col = headerCols[key]
    if (col) {
      row[col - 1] = record[key]
    }
  }

  sheet.appendRow(row)
}

function pollVote_(payload) {
  var pollId = String(payload.poll_id || '').trim()
  var selected = String(payload.selected_option || '').trim().toUpperCase()
  if (!pollId || (selected !== 'A' && selected !== 'B')) {
    return { ok: false, error: 'Invalid poll vote payload' }
  }

  var sheet = getSheet_('polls')
  var h = headerMap_(sheet)
  var idCol = requireHeader_(h, 'poll_id')
  var row = findRowById_(sheet, idCol, pollId)
  if (row < 0) return { ok: false, error: 'Poll not found' }

  var aVotesCol = requireHeader_(h, 'option_a_votes')
  var bVotesCol = requireHeader_(h, 'option_b_votes')
  var totalCol = requireHeader_(h, 'total_votes')
  var winnerCol = requireHeader_(h, 'winning_option')

  var aVotes = Number(sheet.getRange(row, aVotesCol).getValue() || 0)
  var bVotes = Number(sheet.getRange(row, bVotesCol).getValue() || 0)
  if (selected === 'A') aVotes += 1
  if (selected === 'B') bVotes += 1

  var total = aVotes + bVotes
  var winner = aVotes === bVotes ? 'tie' : (aVotes > bVotes ? 'A' : 'B')

  sheet.getRange(row, aVotesCol).setValue(aVotes)
  sheet.getRange(row, bVotesCol).setValue(bVotes)
  sheet.getRange(row, totalCol).setValue(total)
  sheet.getRange(row, winnerCol).setValue(winner)

  return { ok: true }
}

function createPoll_(payload) {
  var question = String(payload.question || '').trim()
  var optionA = String(payload.option_a || '').trim()
  var optionB = String(payload.option_b || '').trim()

  if (!question || !optionA || !optionB) {
    return { ok: false, error: 'Question and options are required' }
  }

  var sheet = getSheet_('polls')
  var h = headerMap_(sheet)

  appendByHeaders_(sheet, h, {
    poll_id: Utilities.getUuid(),
    created_date: nowIso_(),
    question: question,
    option_a: optionA,
    option_b: optionB,
    option_a_votes: 0,
    option_b_votes: 0,
    total_votes: 0,
    winning_option: ''
  })

  return { ok: true }
}

function updatePoll_(payload) {
  var pollId = String(payload.poll_id || '').trim()
  var question = String(payload.question || '').trim()
  var optionA = String(payload.option_a || '').trim()
  var optionB = String(payload.option_b || '').trim()

  if (!pollId || !question || !optionA || !optionB) {
    return { ok: false, error: 'Invalid update poll payload' }
  }

  var sheet = getSheet_('polls')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'poll_id'), pollId)
  if (row < 0) return { ok: false, error: 'Poll not found' }

  sheet.getRange(row, requireHeader_(h, 'question')).setValue(question)
  sheet.getRange(row, requireHeader_(h, 'option_a')).setValue(optionA)
  sheet.getRange(row, requireHeader_(h, 'option_b')).setValue(optionB)

  return { ok: true }
}

function deletePoll_(payload) {
  var pollId = String(payload.poll_id || '').trim()
  if (!pollId) return { ok: false, error: 'poll_id is required' }

  var sheet = getSheet_('polls')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'poll_id'), pollId)
  if (row < 0) return { ok: false, error: 'Poll not found' }

  sheet.deleteRow(row)
  return { ok: true }
}

function setBucketCompleted_(payload) {
  var bucketId = String(payload.bucket_id || '').trim()
  if (!bucketId) return { ok: false, error: 'bucket_id is required' }

  var completed = toBoolean_(payload.completed)
  var sheet = getSheet_('bucket_list')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'bucket_id'), bucketId)
  if (row < 0) return { ok: false, error: 'Bucket item not found' }

  sheet.getRange(row, requireHeader_(h, 'completed')).setValue(completed)
  sheet.getRange(row, requireHeader_(h, 'completed_date')).setValue(completed ? nowIso_() : '')

  return { ok: true }
}

function createBucketItem_(payload) {
  var item = String(payload.item || '').trim()
  if (!item) return { ok: false, error: 'item is required' }

  var sheet = getSheet_('bucket_list')
  var h = headerMap_(sheet)

  appendByHeaders_(sheet, h, {
    bucket_id: Utilities.getUuid(),
    item: item,
    completed_date: '',
    completed: false
  })

  return { ok: true }
}

function updateBucketItem_(payload) {
  var bucketId = String(payload.bucket_id || '').trim()
  var item = String(payload.item || '').trim()
  if (!bucketId || !item) return { ok: false, error: 'bucket_id and item are required' }

  var sheet = getSheet_('bucket_list')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'bucket_id'), bucketId)
  if (row < 0) return { ok: false, error: 'Bucket item not found' }

  sheet.getRange(row, requireHeader_(h, 'item')).setValue(item)
  return { ok: true }
}

function deleteBucketItem_(payload) {
  var bucketId = String(payload.bucket_id || '').trim()
  if (!bucketId) return { ok: false, error: 'bucket_id is required' }

  var sheet = getSheet_('bucket_list')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'bucket_id'), bucketId)
  if (row < 0) return { ok: false, error: 'Bucket item not found' }

  sheet.deleteRow(row)
  return { ok: true }
}

function setCountryVisited_(payload) {
  var countryId = String(payload.country_id || '').trim()
  if (!countryId) return { ok: false, error: 'country_id is required' }

  var visited = toBoolean_(payload.visited)
  var sheet = getSheet_('countries')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'country_id'), countryId)
  if (row < 0) return { ok: false, error: 'Country not found' }

  sheet.getRange(row, requireHeader_(h, 'visited')).setValue(visited)
  sheet.getRange(row, requireHeader_(h, 'visited_date')).setValue(visited ? nowIso_() : '')

  return { ok: true }
}

function setCurrentStudyCompleted_(payload) {
  var studyId = String(payload.study_id || '').trim()
  if (!studyId) return { ok: false, error: 'study_id is required' }

  var completed = toBoolean_(payload.completed)
  var sheet = getSheet_('current_study')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'study_id'), studyId)
  if (row < 0) return { ok: false, error: 'Study row not found' }

  sheet.getRange(row, requireHeader_(h, 'completed')).setValue(completed)

  return { ok: true }
}

function createCountry_(payload) {
  var name = String(payload.country_state_name || '').trim()
  if (!name) return { ok: false, error: 'country_state_name is required' }

  var visited = toBoolean_(payload.visited)
  var sheet = getSheet_('countries')
  var h = headerMap_(sheet)

  appendByHeaders_(sheet, h, {
    country_id: Utilities.getUuid(),
    country_state_name: name,
    visited_date: visited ? nowIso_() : '',
    visited: visited
  })

  return { ok: true }
}

function updateCountry_(payload) {
  var countryId = String(payload.country_id || '').trim()
  var name = String(payload.country_state_name || '').trim()
  if (!countryId || !name) return { ok: false, error: 'country_id and country_state_name are required' }

  var sheet = getSheet_('countries')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'country_id'), countryId)
  if (row < 0) return { ok: false, error: 'Country not found' }

  sheet.getRange(row, requireHeader_(h, 'country_state_name')).setValue(name)
  return { ok: true }
}

function deleteCountry_(payload) {
  var countryId = String(payload.country_id || '').trim()
  if (!countryId) return { ok: false, error: 'country_id is required' }

  var sheet = getSheet_('countries')
  var h = headerMap_(sheet)
  var row = findRowById_(sheet, requireHeader_(h, 'country_id'), countryId)
  if (row < 0) return { ok: false, error: 'Country not found' }

  sheet.deleteRow(row)
  return { ok: true }
}
