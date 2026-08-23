# Untrusted model output

A language model may emit JSON. That JSON is still untrusted. Compile only after closed-world parsing.

```bash
# extra key — must fail
node dist/cli.js compile examples/model-intent/untrusted-extra-key.json

# valid typed intent — compiles
node dist/cli.js compile examples/model-intent/trusted-shape.json
```

Do not pass model text to `write-formulas`. Do not skip `parseScaleBankIntent` / `compileScaleBank`.
