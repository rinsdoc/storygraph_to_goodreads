### **Guide: Uploading Storygrahp Library to Goodreads**
This guide will walk you through the steps needed to **compare, split, and convert CSV files** using Python scripts.

---

## ⚙ **1. Setup: Install Python on Your Computer**
Before running the scripts, you **must** have Python installed.  

### **Check if Python is installed**  
🔹 Open **Command Prompt (Windows)** or **Terminal (Mac/Linux)** and type:  
```sh
python --version
```
If Python is installed, you will see something like:  
```
Python 3.x.x
```
If you **don't** have Python installed, download and install it from:  
🔗 [Python official website](https://www.python.org/downloads/)  

![image](https://github.com/user-attachments/assets/f1d9d3ee-4580-405e-973f-0e2394eec654)


✅ **During installation**, make sure to check the box **"Add Python to PATH"**.

---

## 📂 **2. Download the CSV Files & Scripts**
You need the following files in the **same folder** on your computer:
- **Your CSV files** (from StoryGraph, Goodreads, or other sources)
- The script files:
  - `compare_csv.py` (to find new books in your collection)
  - `split.py` (to break large CSV files into smaller parts)
  - `storygraph_to_goodreads.py` (to convert StoryGraph exports for Goodreads)

---

## 🔄 **3. Using the Scripts**
Each script serves a different purpose. You will run them using **Command Prompt (Windows) or Terminal (Mac/Linux).**  

###  **A. Compare Two CSV Files (`compare_csv.py`)**  
💡 **Purpose**: Check if books in a new CSV file are already in an existing collection.

#### **Usage**
```sh
python compare_csv.py new_library.csv existing_library.csv new_file.csv
```
✅ This creates `new_file.csv`, containing books that **are in the new file but not in the existing file**.

---

###  **B. Split a Large CSV File (`split.py`)**  
💡 **Purpose**: If your CSV file is too big for Goodreads, this script splits it into smaller files.

#### **Usage**
```sh
python split.py your_file.csv --chunk-size 50
```
✅ This creates files like `split_file_1.csv`, `split_file_2.csv` with **50 rows each**.

🔹 I you want the files to be larger or smaller you can change the number in the command to whatever you like.
#### **Example**
```sh
python split.py your_file.csv --chunk-size 100
```

💡 **To split by reading status (Read, To-Read, etc.), use:**
```sh
python split.py your_file.csv split_file --by-status
```
This creates separate files like:
- `split_file_read.csv`
- `split_file_to-read.csv`
- `split_file_currently-reading.csv`

---

###  **C. Convert StoryGraph CSV to Goodreads Format (`storygraph_to_goodreads.py`)**  
💡 **Purpose**: Transform a StoryGraph CSV export into a format **Goodreads** can import.

#### **Usage**
```sh
python storygraph_to_goodreads.py storygraph_export.csv goodreads_import.csv
```
✅ This creates `goodreads_import.csv`, which you can **import into Goodreads**.

---

## 🎯 **4. Importing the CSV File into Goodreads**
1. **Go to Goodreads Import Page**  
   🔗 [https://www.goodreads.com/review/import](https://www.goodreads.com/review/import)  
2. Click **"Choose File"** and select the **converted CSV file**.  
3. Click **"Upload"** and wait for Goodreads to process it.  

---

## ❓ **Troubleshooting** ❓
🔹 **Command not found?**  
Make sure you are in the correct folder. Use:  
```sh
cd path/to/your/folder
```
Then try again.

🔹 **File not found error?**  
Ensure your CSV files are in the same folder as the scripts.

🔹 **Python not recognized?**  
Try using `python3` instead of `python`, like this:  
```sh
python3 compare_csv.py new.csv existing.csv output.csv
```

---

## 🎉 **Done!**
Hope this helped you in your reading journey!

