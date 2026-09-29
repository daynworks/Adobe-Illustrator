/*
  Move Selected Anchor By Angle (v1.1)
  Adobe Illustrator JSX

  Select exactly one anchor point with the Direct Selection tool, then run.
*/

(function () {
    var MM_TO_POINTS = 72 / 25.4;

    function isNumber(value) {
        return value !== "" && isFinite(Number(value));
    }

    function selectedAnchorPointsIn(item, results) {
        var i, j;

        if (!item) {
            return;
        }

        if (item.typename === "PathItem") {
            for (i = 0; i < item.pathPoints.length; i++) {
                // An anchor selected with Direct Selection has this state.
                if (item.pathPoints[i].selected === PathPointSelection.ANCHORPOINT) {
                    results.push(item.pathPoints[i]);
                }
            }
        } else if (item.typename === "CompoundPathItem") {
            for (j = 0; j < item.pathItems.length; j++) {
                selectedAnchorPointsIn(item.pathItems[j], results);
            }
        } else if (item.typename === "GroupItem") {
            for (j = 0; j < item.pageItems.length; j++) {
                selectedAnchorPointsIn(item.pageItems[j], results);
            }
        }
    }

    function getExactlyOneSelectedAnchor(doc) {
        var points = [];
        var i;

        for (i = 0; i < doc.selection.length; i++) {
            selectedAnchorPointsIn(doc.selection[i], points);
        }

        return points;
    }

    function showDialog(point) {
        var dialog = new Window("dialog", "Move Selected Anchor by Angle");
        dialog.orientation = "column";
        dialog.alignChildren = "fill";
        dialog.spacing = 10;
        dialog.margins = 16;

        var intro = dialog.add("statictext", undefined, "Enter the line height, angle, and movement direction.");
        intro.alignment = "left";

        var heightGroup = dialog.add("group");
        heightGroup.add("statictext", undefined, "Line height:");
        var heightField = heightGroup.add("edittext", undefined, "155");
        heightField.characters = 10;
        heightGroup.add("statictext", undefined, "mm");

        var angleGroup = dialog.add("group");
        angleGroup.add("statictext", undefined, "Angle:");
        var angleField = angleGroup.add("edittext", undefined, "5");
        angleField.characters = 10;
        angleGroup.add("statictext", undefined, "degrees");

        var directionGroup = dialog.add("group");
        directionGroup.add("statictext", undefined, "Direction:");
        // A dropdown avoids radio-button grouping differences between Illustrator versions.
        var directionList = directionGroup.add("dropdownlist", undefined, ["Left", "Right", "Up", "Down"]);
        directionList.selection = 1;

        var preview = dialog.add("checkbox", undefined, "Preview movement");

        // Save the exact starting geometry so Preview can be updated or cancelled safely.
        var initialAnchor = point.anchor;
        var initialLeft = point.leftDirection;
        var initialRight = point.rightDirection;
        var originalAnchor = [initialAnchor[0], initialAnchor[1]];
        var originalLeft = [initialLeft[0], initialLeft[1]];
        var originalRight = [initialRight[0], initialRight[1]];
        var previewApplied = false;

        function restoreOriginal() {
            point.anchor = [originalAnchor[0], originalAnchor[1]];
            point.leftDirection = [originalLeft[0], originalLeft[1]];
            point.rightDirection = [originalRight[0], originalRight[1]];
            previewApplied = false;
        }

        function currentValues() {
            var height = heightField.text.replace(/^\s+|\s+$/g, "");
            var angle = angleField.text.replace(/^\s+|\s+$/g, "");

            if (!isNumber(height) || Number(height) <= 0 ||
                    !isNumber(angle) || Number(angle) < 0 || Number(angle) >= 90) {
                return null;
            }

            return {
                heightMm: Number(height),
                angleDeg: Number(angle),
                direction: directionList.selection.text.toLowerCase()
            };
        }

        function updatePreview() {
            var values;
            var offsetPoints;
            var dx = 0;
            var dy = 0;

            restoreOriginal();
            if (!preview.value) {
                return;
            }

            values = currentValues();
            if (!values) {
                return;
            }

            offsetPoints = values.heightMm * Math.tan(values.angleDeg * Math.PI / 180) * MM_TO_POINTS;
            if (values.direction === "left") {
                dx = -offsetPoints;
            } else if (values.direction === "right") {
                dx = offsetPoints;
            } else if (values.direction === "up") {
                dy = offsetPoints;
            } else {
                dy = -offsetPoints;
            }
            movePointAndHandles(point, dx, dy);
            previewApplied = true;
            app.redraw();
        }

        var buttons = dialog.add("group");
        buttons.alignment = "right";
        var cancel = buttons.add("button", undefined, "Cancel", {name: "cancel"});
        var apply = buttons.add("button", undefined, "Apply", {name: "ok"});

        apply.onClick = function () {
            var values = currentValues();

            if (!isNumber(heightField.text.replace(/^\s+|\s+$/g, "")) || Number(heightField.text) <= 0) {
                alert("Line height must be a number greater than 0 (in mm).");
                heightField.active = true;
                return;
            }
            if (!values) {
                alert("Angle must be a number from 0 up to (but not including) 90 degrees.");
                angleField.active = true;
                return;
            }

            dialog.result = values;
            dialog.result.previewApplied = previewApplied;
            dialog.close(1);
        };

        cancel.onClick = function () {
            restoreOriginal();
            app.redraw();
            dialog.close(0);
        };
        preview.onClick = updatePreview;
        heightField.onChanging = updatePreview;
        angleField.onChanging = updatePreview;
        directionList.onChange = updatePreview;
        heightField.active = true;
        heightField.selection = [0, heightField.text.length];

        return dialog.show() === 1 ? dialog.result : null;
    }

    function movePointAndHandles(point, dx, dy) {
        var anchor = point.anchor;
        var left = point.leftDirection;
        var right = point.rightDirection;

        // Moving the selected anchor's handles with it maintains the local curve shape.
        point.anchor = [anchor[0] + dx, anchor[1] + dy];
        point.leftDirection = [left[0] + dx, left[1] + dy];
        point.rightDirection = [right[0] + dx, right[1] + dy];
    }

    if (app.documents.length === 0) {
        alert("Open an Illustrator document, select one anchor point, then run this script.");
        return;
    }

    var doc = app.activeDocument;
    var anchors = getExactlyOneSelectedAnchor(doc);

    if (anchors.length === 0) {
        alert("No anchor point is selected. Use the Direct Selection tool (A) to select exactly one anchor point, then run the script.");
        return;
    }
    if (anchors.length > 1) {
        alert("More than one anchor point is selected. Use the Direct Selection tool (A) to select exactly one anchor point, then run the script.");
        return;
    }

    var settings = showDialog(anchors[0]);
    if (!settings) {
        return;
    }

    var offsetPoints = settings.heightMm * Math.tan(settings.angleDeg * Math.PI / 180) * MM_TO_POINTS;
    var dx = 0;
    var dy = 0;

    if (settings.direction === "left") {
        dx = -offsetPoints;
    } else if (settings.direction === "right") {
        dx = offsetPoints;
    } else if (settings.direction === "up") {
        dy = offsetPoints;
    } else {
        dy = -offsetPoints;
    }

    if (!settings.previewApplied) {
        movePointAndHandles(anchors[0], dx, dy);
    }
})();
