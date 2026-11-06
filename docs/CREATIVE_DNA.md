# Creative DNA

Current capture saves HTTPS source links, notes, a collection, and a versioned notes-based template. DNA inspection explicitly says no video analysis/OCR has run. Adaptation creates a project with the reference ID and notes as its brief. There is no automatic downloading of private or restricted reels.

The initial representation follows EditDNA’s separation of pacing, overlays, hook, and provenance. Current values are manual defaults rather than measured cut timing. `source: user_notes`, `confidence: manual`, and limitations preserve that distinction.

Next slice: run EditDNA’s deterministic shot/OCR/audio analyzers in a Python worker on uploaded, permitted footage; preserve original license and confidence fields; show the user which fields were measured, inferred, or manually set. DaVinci Resolve must remain optional. Automatic trend discovery is not implemented.
