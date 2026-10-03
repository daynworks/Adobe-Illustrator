# Adobe-Illustrator
## Adobe illustrator Scripts, created or modified by me.
### **How install:**
Download the scripts
Place <script_name>.jsx in the Illustrator Scripts folder: OS X: /Applications/Adobe Illustrator [vers.]/Presets.localized/en_GB/Scripts Windows (32 bit): C:\Program Files (x86)\Adobe\Adobe Illustrator [vers.]\Presets\en_GB [or your localization]\Scripts
Windows (64 bit): C:\Program Files\Adobe\Adobe Illustrator [vers.] (64 Bit)\Presets\en_GB [or your localization]\Scripts\
Restart Illustrator

## Selection Grid Extender

An Adobe Illustrator script (`Selection_Grid Maker & Extender_DAYN_v1.5.jsx`) that uses the selected object as a base square to generate a customizable grid[cite: 1].

## How to use

1. Open an Adobe Illustrator document and select one or more objects[cite: 1].
2. Run the script (`Selection_Grid Maker & Extender_DAYN_v1.5.jsx`)[cite: 1]. 
3. Use the dialog window to set your desired **Columns**, **Rows**, and **Gutters**[cite: 1].
4. To expand the grid beyond the object, add extra cells using the **Left**, **Right**, **Top**, and **Bottom** extension inputs[cite: 1].
5. Toggle **Live Preview** to see how the grid looks on your canvas[cite: 1].
6. Click **Apply** to generate the grid[cite: 1].

## How it works

* **The Base Square:** The script reads the physical bounds of your selected object(s) and uses that exact area as the foundational "base square"[cite: 1].
* **Grid Math:** It divides the base square into the specified number of cells[cite: 1]. If you choose to "Extend outside," it simply repeats cells of that exact same size outward[cite: 1]. 
* **Smart Rotation:** If you apply an angle, the script calculates a "tight fit" by measuring the selection's actual anchor points and bezier curves (tangent points)[cite: 1]. This ensures the rotated grid perfectly touches the outermost edges of your shape, even on rounded corners[cite: 1]. 
* **Output:** The script draws the grid using standard paths on a brand new layer named `Selection Grid - [Timestamp]`[cite: 1]. You can choose to automatically convert these paths into Illustrator guides or lock the layer upon creation[cite: 1].

* <img width="1917" height="1020" alt="image" src="https://github.com/user-attachments/assets/9b291460-c176-408d-b26c-2031840c6e89" />
