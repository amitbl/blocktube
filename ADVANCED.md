# Advanced Blocking

(this file is temporary! the documentation should be written better and should
be stored somewhere other than the repo root)

Advanced blocking lets you to write a JavaScript function to block videos in
more detail than the regular filters can provide.

To enable advanced blocking, check the _Enable advanced blocking_ box and add
your rules to the _Advanced blocking rules_ box underneath.

The rest of this file expects some form of JavaScript knowledge.

## Rule structure

All rules must be contained in an anonymous function that receives a single `video`
object as an argument. The initial contents of the box will have a template for this.

This function returns a boolean, where `true` means the video will be blocked,
and `false` will leave the video up.

| Warning |
|-|
| Be especially careful with the function syntax. If you are not using an arrow
function, you might need to wrap your function declaration in parentheses. |

## Example

```javascript
video => {
  // Add custom conditions below

  // If video title contains "something"
  //                                and If the channel name contains "otherthing"
  if (video.title.match("something") && video.channelName.match("otherthing")) {
    // Block the video
    return true;
  }

  // ... more conditions ...

  // Custom conditions did not match, do not block
  return false;
}
```

## `video` object reference

It might be a wise idea to check if these keys exist before using them, as
certain parts of YouTube might omit certain data.

In case this documentation is outdated, `const filterRules` in [inject.js] can
be used as a more up-to-date reference.

[inject.js]: https://github.com/amitbl/blocktube/blob/master/src/scripts/inject.js#L49

### Videos (recommendations, search, etc.)

- `channelId` and `channelName`: ID and name of the video uploader
- `publishTimeText`: "Human friendly" publish time text. (1 year ago, 5 days
    ago, etc.)
- `title`: Title of the video
- `videoId`: ID of the video
- `vidLength`: Length of the video, in seconds
- `viewCount`: Count of views the video has
- `channelBadges`: Badges next to the channel name. The current values are:
  - `verified`: The classic checkmark
  - `artist`: The music note
- `badges`: Badges under the video. The current values are:
  - `live`: Live stream indicator

### Comments

- `channelId` and `channelName`: ID and name of the commenter
- `comment`: Text of the comment
