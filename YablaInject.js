(function YablaInject(document) {
    //API
    function levenshteinDistance(a, b) {
        if (a.length == 0) return b.length;
        if (b.length == 0) return a.length;

        var matrix = [];

        // increment along the first column of each row
        var i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // increment each column in the first row
        var j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1)); // deletion
                }
            }
        }

        return matrix[b.length][a.length];
    }

    //Config
    var SCRIPT_SEARCH_TERM = 'CAPTIONS';
    var EVENT_LOOP_TIMEOUT = 2000;
    var ALPHANUMERIC_REGEX = /[^A-Za-z_]/g;

    //Find the script tag containing the captions
    var query = document.getElementsByTagName('script');
    var scriptContents;
    for (var i = 0; i < query.length; i++) {
        if (query[i].innerHTML.indexOf(SCRIPT_SEARCH_TERM) >= 0) {
            scriptContents = query[i].innerHTML;
        }
    }
    if (!scriptContents) return console.warn('YablaInject could not find Yabla script on this page', scriptContents);


    //Process the contents of the script tag to find the JSON blob representing the captions
    //Find the line with the captions JSON
    var lines = scriptContents.split(';');
    var line;
    lines.forEach(function (l) {
        if (l.indexOf(SCRIPT_SEARCH_TERM) >= 0) {
            line = l;
        }
    });
    if (!line) return console.warn('YablaInject could not find a line with captions in this script', line);

    //Process the line
    var captionJsonString = line.split('=')[1].replace(';', '').trim();

    //Parse the JSON from the line
    var CAPTIONS;

    try {
        CAPTIONS = JSON.parse(captionJsonString);
    } catch (e) {
        return console.error('Error parsing captionsJsonString', e);
    }

    if (!CAPTIONS) return console.warn('YablaInject could not find valid captions on this page', CAPTIONS);


    //Process the captions into readable transcript
    var TRANSCRIPT, TRANSCRIPT_LINES, TRANSLATION_LINES, TRANSLATION, PROCESSED_TRANSCRIPT_LINES;

    TRANSCRIPT_LINES = CAPTIONS.map(function (a) {
        return a.transcript;
    });
    PROCESSED_TRANSCRIPT_LINES = CAPTIONS.map(function (a) {
        return {
            processed: a.transcript.replace(ALPHANUMERIC_REGEX, '').toLowerCase().trim(),
            unprocessed: a.transcript
        }
    });

    TRANSCRIPT = TRANSCRIPT_LINES.join('\n\n');

    TRANSLATION_LINES = CAPTIONS.map(function (a) {
        return a.translation;
    });

    TRANSLATION = TRANSLATION_LINES.join('\n\n');

    //Dump the transcript to the console before doing anything funky
    console.info('Dumping Yabla transcript for your reading pleasure...');
    console.info('English: ', TRANSLATION);
    console.info('Spanish: ', TRANSCRIPT);


    //DOM Manipulation loops
    function loop() {
        var question_wrap = document.getElementsByClassName('question_wrap')[0];
        var question_answer = document.getElementById('cloze_answer');

        if (question_wrap&&question_answer&&(question_answer.value==='')) {
            var QUESTION_TEXT_BAD_WORDS = ['slow', 'replay', 'submit', 'answer', 'next', 'question']
            var processedQuestionText = question_wrap.textContent.replace(ALPHANUMERIC_REGEX, '').toLowerCase().trim();
            QUESTION_TEXT_BAD_WORDS.forEach(function (word) {
                processedQuestionText = processedQuestionText.replace(word, '');
            });

            //Remove any complete lines of transcript from the processed line because a complete transcript line
            //Will never hold the answer
            PROCESSED_TRANSCRIPT_LINES.forEach(function (processedTranscriptLine) {
                processedQuestionText=processedQuestionText.replace(processedTranscriptLine.processed, '');
            });

            // //Sort transcript entries by closeness and remove dupes
            var candidates = PROCESSED_TRANSCRIPT_LINES
                .filter(function (item, pos) {
                    var index;
                    PROCESSED_TRANSCRIPT_LINES.forEach(function (a, p) {
                        if (a.processed === item.processed) index = p;
                    });
                    return index === pos;
                })
                .sort(function (a, b) {
                    return levenshteinDistance(a.processed, processedQuestionText)-levenshteinDistance(b.processed, processedQuestionText);
                });

            var processedTranscriptLine = candidates[0];


            //Find the missing word
            var missingWords = [];
            processedTranscriptLine.unprocessed.replace(/[,?;':.\\\/\(\)]/g,'').split(' ').forEach(function (word) {
                var processedWord = word.replace(ALPHANUMERIC_REGEX, '').toLowerCase().trim();
                if (processedQuestionText.indexOf(processedWord)>=0) return;
                if (missingWords.indexOf(processedWord)>=0) return;
                missingWords.push(word);
            });

            var missingPhrase = missingWords.join(' ');

            question_answer.value=missingPhrase;
        }


        //Another iteration
        return setTimeout(loop, EVENT_LOOP_TIMEOUT);
    }

    //Start the loop
    loop();
})(document);