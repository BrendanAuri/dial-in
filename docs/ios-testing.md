# iOS testing checklist

Dial In is tested in Chromium during development, which can't stand in for Safari on an iPhone. Run through this on a real iPhone (and an iPad if you have one) after each deploy. It needs the deployed HTTPS site: service workers, installing and the clipboard don't work over plain `http://` on the local network.

## In Safari (not installed)

- [ ] The start screen loads; **Tap to start** gives sound on the first tap.
- [ ] With the ringer switch on **silent**, sound still plays (the app asks for a "playback" audio session). If not, note the iOS version.
- [ ] Headphones and the speaker both work; switching between them mid-note doesn't stop sound.
- [ ] Knobs: dragging turns the knob without scrolling the page; double-tap resets it; nothing zooms.
- [ ] Text fields (save a sound, search, replay code) don't zoom the page when focused.
- [ ] The Home screen shows the **Install Dial In** card with the Share → Add to Home Screen instructions; **Got it** hides it for good.

## Installed (Share → Add to Home Screen)

- [ ] The icon is the knob on a dark background, with no white corners.
- [ ] It opens full screen with the dark status bar; nothing sits under the notch or the home indicator (check the top bar and the bottom dock).
- [ ] Portrait and landscape both lay out without sideways scrolling.
- [ ] Free Play keyboard: two fingers play two notes; Hold sustains; knobs change the held sound live.
- [ ] Rounds: Target / Mine / A/B play; Submit scores in about a second; the spectrum strip moves while sound plays.
- [ ] Daily: the share button opens the iOS share sheet with the result text.

## Interruptions and offline

- [ ] Switch to another app and back: the next Play still makes sound (the audio context resumes).
- [ ] Take or decline a call mid-round, then play again.
- [ ] Turn on **Airplane Mode**, close the app fully, open it again: it loads and a round can be played and scored.
- [ ] Progress, saved sounds and the daily streak are still there after closing and reopening the app.

## After the next deploy

- [ ] Open the installed app: a **"A new version of Dial In is ready"** notice appears; **Reload** switches to it; **Later** keeps playing.

## Known iOS limits

- Safari can clear data for sites that aren't installed and haven't been used for about a week. Installing avoids that; exporting sounds from Free Play is the backup.
- Web push (for daily reminders) needs a server, so reminders wait for the Capacitor builds.
