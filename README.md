# restrict-focus

A small library to restrict focus-type events (focus, tabbing, arrow up/down) to only a specified element.

Works with the shadow DOM, so easy to use with web components.

# To Use

```
npm install restrict-scroll
```

and then

```
import restrictFocus from 'restrict-focus';

restrictFocus.add(element);
```

to remove the focus restriction simply

```
restrictFocus.remove(element);
```
