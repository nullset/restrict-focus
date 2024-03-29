# restrict-focus

A small library to restrict focus-type events (focus, tabbing, arrow up/down) to only a specified element.

Works with the shadow DOM, so easy to use with web components.

## To Use

```
npm install restrict-scroll
```

and then

```
import restrictFocus from 'restrict-focus';

restrictFocus.add(element);
```

When added to restrict focus, a user's ability to focus _outside_ an element via tab, arrow keys, clicking, etc. is restricted ... they simply won't be able to do those things. Within the restricted element, however, tabbing, arrow keys, clicking, etc. all work as normal.

Any element which is added to restrictFocus goes into a master list of focus restricted elements. Only the most recently added element is "active" at any given time. When an element is removed from the restrictFocus master list, the preceeding element becomes "active".

By maintaining a list of restricted elements, we easily gain the ability to "layer" focus restrictions. Let's say a user opens a menu and you restrict focus to just that open menu. But then the user clicks a link inside the menu which opens a sub-menu, and you restrict focus to that sub-menu. You end up with something like this:

```
restrictFocus.add(menu);
restrictFocus.add(subMenu);

console.log(restrictFocus.list); /* returns [menu, subMenu] */
```

All is well and good, the user cannot focus outside of the sub-menu element. When the user closes the sub-menu you remove the sub-menu from the restrictFocus master list. The original menu (which is still on the page) then becomes the "active" element, and focus reverts to becoming restricted to _it_.

To remove the focus restriction simply

```
restrictFocus.remove(element);
```

### API

`restrictFocus.list` - Returns an array of all elements which have focus restricted to them. Order from oldest to most recent.

`restrictFocus.activeElement` - Return the "active" element which focus is currently restricted to.

`restrictFocus.add(element, options = {})` - Add an element to the list of restricted elements. The `options` argument is optional. See below for more details about the possible options.

- **`allowEvents`**

  When _adding_ an element to restrictFocus, it is possible to allow certain events to "pierce" the restrictFocus boundary. This makes it possible to, for example, restrict focusing to a menu so that tabbing will not escape the menu, but clicking _outside_ the menu will close the menu.

  To enable this ability to allow certain events outside the restrictFocus boundary, simply pass it in as an option. The `allowEvents` option is an array, and can accept multiple event types (`mousedown`, `mouseup`, `click`, etc.).

  ```
  restrictFocus.add(element, { allowEvents: ['click'] });
  ```

- **`callback`**

  A function which will be fired once the given element is added to the restrictFocus master list.

  ```
  restrictFocus.add(element, { callback: () => alert('callback fired') });
  ```

`restrictFocus.remove(element, options = {})` - Remove an element from the list of restricted elements. The `options` argument is optional. See below for more details about the possible options.

- **`callback`**

  A function which will be fired once the given element is removed from
  the restrictFocus master list.

  ```
  restrictFocus.remove(element, { callback: () => alert('callback fired') });
  ```

`restrictFocus.focusableElements` -Returns an object which returns a few bits of potentially useful information:

- `list` - Returns an array of all child elements of the current `restrictFocus.activeElement` which can _potentially_ be focused upon.

  Note these are only _possbile_ elements (in that they are within the restricted focus area region, and have an explicit or implicit tabindex set).

  Whether or not any element within this list is _actually_ focusable can only be determined by attempting to focus on it as other considerations (ex. visibility) may make focusing on it impossible.

- `first` - Returns the first element in the list which is potentially focusable.
- `last` - Returns the last element in the list which is potentially focusable.
- `next` - Returns the next element in the list which is potentially focusable.
- `previous` - Returns the previous element in the list which is potentially focusable.

### Options

#### allowEvents

When _adding_ an element to restrictFocus, it is possible to allow certain events to "pierce" the restrictFocus boundary. This makes it possible to, for example, restrict focusing to a menu so that tabbing will not escape the menu, but clicking _outside_ the menu will close the menu.

To enable this ability to allow certain events outside the restrictFocus boundary, simply pass it in as an option. The `allowEvents` option is an array, and can accept multiple event types (`mousedown`, `mouseup`, `click`, etc.).

```
restrictFocus.add(element, {allowEvents: ['click']});
```

#### callbacks

Both `restrictFocus.add` and `restrictFocus.remove` provide a callback mechanism, that allows for any callback function to be fired once the given element is added to, or removed from, the restrictFocus.

To use this option, simply pass it in as an option.

```
restrictFocus.add(element, {callback: () => { /* some function */ }})`

restrictFocus.remove(element, {callback: () => { /* some function */ }})`
```

## Notable updates

### 0.1.11

Fixed an error when user is using a touch device (mobile phone) rather than a desktop device.

### 0.1.9

Fix an issue in Firefox that would allow focus to escape the restricted area if the restricted area had a tabindex of -1.

If the user tabs through focusable elements on the page they may end up tabbing to the _browser's_ UI (ex tabs, address bar, etc.). When focus is restricted and a user tabs _back_ to the page, the focus would end up on the first focusable element, rather than the restricted focus area. Fixed this issue so that the user will always end up within the restricted focus area when tabbing back to the page from the browser's chrome.

### 0.1.7

Fix an error that was preventing the `keydown` event from recognizing that the event had happened inside an `input`, `select`, or `textarea`.

### 0.1.5

When we allow certain events to "pierce" the focus restriction, this means that when those events are fired outside of the active element we want to effectively cancel all restrictFocus restrictions.

Added code to cancel all restrictions when an allowed event is present and that event takes place outside the restricted active element.
