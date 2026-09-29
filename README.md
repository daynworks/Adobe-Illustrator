# Adobe-Illustrator
## Adobe illustrator Scripts, created or modified by me.
### **How install:**
Download the scripts
Place <script_name>.jsx in the Illustrator Scripts folder: OS X: /Applications/Adobe Illustrator [vers.]/Presets.localized/en_GB/Scripts Windows (32 bit): C:\Program Files (x86)\Adobe\Adobe Illustrator [vers.]\Presets\en_GB [or your localization]\Scripts
Windows (64 bit): C:\Program Files\Adobe\Adobe Illustrator [vers.] (64 Bit)\Presets\en_GB [or your localization]\Scripts\
Restart Illustrator

## **Move Selected Anchor By Angles**
## Usage

**Move Selected Anchor By Angle** is an Adobe Illustrator script that shifts a single anchor point sideways or vertically by a distance calculated from a line height and an angle.

### How to run

1. Open a document in Illustrator.
2. Select the **Direct Selection tool (A)** and click exactly **one** anchor point.
3. Go to **File > Scripts > Other Script…** and choose `Move_Selected_Anchor_By_Angle_DAYN.jsx`.
4. In the dialog, enter:
   - **Line height** (mm): the length of the line
   - **Angle** (degrees): from 0 up to, but not including, 90
   - **Direction**: Left, Right, Up, or Down
5. Tick **Preview movement** to see the result live, then click **Apply**.

### How it works

The anchor moves by:

`offset = line height × tan(angle)`

The point's handles move with it, so the local curve shape is preserved. Cancel restores the original position.

### Notes

- Exactly one anchor point must be selected, otherwise the script shows a warning.
- Default values are 50 mm and 5°.
- Requires Adobe Illustrator with ExtendScript (.jsx) support.


<img width="940" height="475" alt="image" src="https://github.com/user-attachments/assets/2a7c8135-d12f-4844-a569-9a4926e367d7" />
