import { Component, OnInit } from '@angular/core';
import { VERSION } from '@angular/core';
import * as dwv from 'dwv';
import { MatDialog } from '@angular/material/dialog';
import { TagsDialogComponent } from './tags-dialog.component';

// gui overrides

// get element
dwv.gui.getElement = dwv.gui.base.getElement;

// Image decoders (for web workers)
dwv.image.decoderScripts = {
    jpeg2000: 'assets/dwv/decoders/pdfjs/decode-jpeg2000.js',
    'jpeg-lossless': 'assets/dwv/decoders/rii-mango/decode-jpegloss.js',
    'jpeg-baseline': 'assets/dwv/decoders/pdfjs/decode-jpegbaseline.js',
    rle: 'assets/dwv/decoders/dwv/decode-rle.js'
};

@Component({
  selector: 'app-dwv',
  templateUrl: './dwv.component.html',
  styleUrls: ['./dwv.component.scss']
})

export class DwvComponent implements OnInit {
  public versions: any;
  public tools = {
      Scroll: {},
      ZoomAndPan: {},
      WindowLevel: {},
      Draw: {
          options: ['Ruler'],
          type: 'factory',
          events: ['draw-create', 'draw-change', 'draw-move', 'draw-delete']
      }
  };
  public selectedTool = 'Select Tool';
  public loadProgress = 0;
  public dataLoaded = false;

  private dwvApp: any;
  private metaData: any[];

  // drop box class name
  private dropboxClassName = 'dropBox';
  private borderClassName = 'dropBoxBorder';
  private hoverClassName = 'hover';

  constructor(public dialog: MatDialog) {
    this.versions = {
      dwv: dwv.getVersion(),
      angular: VERSION.full
    };
  }

  ngOnInit() {
    // create app
    this.dwvApp = new dwv.App();
    // initialise app
    this.dwvApp.init({
      containerDivId: 'dwv',
      tools: this.tools
    });
    // handle load events
    let nReceivedError = null;
    let nReceivedAbort = null;
    this.dwvApp.addEventListener('load-start', (/*event*/) => {
      this.dataLoaded = false;
      nReceivedError = 0;
      nReceivedAbort = 0;
    });
    this.dwvApp.addEventListener('load-progress', (event) => {
      this.loadProgress = event.loaded;
    });
    this.dwvApp.addEventListener('load', (/*event*/) => {
      // set dicom tags
      this.metaData = dwv.utils.objectToArray(this.dwvApp.getMetaData());
      // set the selected tool
      let selectedTool = 'Scroll';
      if (this.dwvApp.isMonoSliceData() &&
        this.dwvApp.getImage().getNumberOfFrames() === 1) {
        selectedTool = 'ZoomAndPan';
      }
      this.onChangeTool(selectedTool);
      // hide dropBox
      this.hideDropbox();
      // set data loaded flag
      this.dataLoaded = true;
    });
    this.dwvApp.addEventListener('load-end', (/*event*/) => {
      if (nReceivedError) {
        this.loadProgress = 0;
        alert('Received errors during load. Check log for details.');
      }
      if (nReceivedAbort) {
        this.loadProgress = 0;
        alert('Load was aborted.');
      }
    });
    this.dwvApp.addEventListener('error', (event) => {
      console.error(event.error);
      ++nReceivedError;
    });
    this.dwvApp.addEventListener('abort', (/*event*/) => {
      ++nReceivedAbort;
    });

    // handle key events
    this.dwvApp.addEventListener('keydown', (event) => {
        this.dwvApp.defaultOnKeydown(event);
    });
    // handle window resize
    window.addEventListener('resize', this.dwvApp.onResize);

    // setup drop box
    this.setupDropbox();

    // possible load from location
    dwv.utils.loadFromUri(window.location.href, this.dwvApp);
  }

  /**
   * Get the tool names as a string array.
   */
  get toolNames(): string[] {
      return Object.keys(this.tools);
  }

  /**
   * Handle a change tool event.
   * @param tool The new tool name.
   */
  onChangeTool = (tool: string) => {
    if ( this.dwvApp ) {
      this.selectedTool = tool;
      this.dwvApp.setTool(tool);
      if (tool === 'Draw') {
        this.onChangeShape(this.tools.Draw.options[0]);
      }
    }
  }

  /**
   * Handle a change draw shape event.
   * @param shape The new shape name.
   */
  private onChangeShape = (shape: string) => {
    if ( this.dwvApp && this.selectedTool === 'Draw') {
      this.dwvApp.setDrawShape(shape);
    }
  }

  /**
   * Handle a reset event.
   */
  onReset = () => {
    if ( this.dwvApp ) {
      this.dwvApp.resetDisplay();
    }
  }

  /**
   * Open the DICOM tags dialog.
   */
  openTagsDialog = () => {
    this.dialog.open(TagsDialogComponent,
      {
        width: '80%',
        height: '90%',
        data: {
          title: 'DICOM Tags',
          value: this.metaData
        }
      }
    );
  }

  // drag and drop [begin] -----------------------------------------------------

  /**
   * Setup the data load drop box: add event listeners and set initial size.
   */
  private setupDropbox = () => {
      // start listening to drag events on the layer container
      const layerContainer = this.dwvApp.getElement('layerContainer');
      if (layerContainer) {
        layerContainer.addEventListener('dragover', this.onDragOver);
        layerContainer.addEventListener('dragleave', this.onDragLeave);
        layerContainer.addEventListener('drop', this.onDrop);
      }
      // set the initial drop box size
      const box = this.dwvApp.getElement(this.dropboxClassName);
      if (box) {
        const size = this.dwvApp.getLayerContainerSize();
        const dropBoxSize = 2 * size.height / 3;
        box.setAttribute(
          'style',
          'width:' + dropBoxSize + 'px;height:' + dropBoxSize + 'px');
      }
  }

  /**
   * Handle a drag over.
   * @param event The event to handle.
   */
  private onDragOver = (event: DragEvent) => {
    // prevent default handling
    event.stopPropagation();
    event.preventDefault();
    // update box border
    const box = this.dwvApp.getElement(this.borderClassName);
    if (box && box.className.indexOf(this.hoverClassName) === -1) {
        box.className += ' ' + this.hoverClassName;
    }
  }

  /**
   * Handle a drag leave.
   * @param event The event to handle.
   */
  private onDragLeave = (event: DragEvent) => {
    // prevent default handling
    event.stopPropagation();
    event.preventDefault();
    // update box class
    const box = this.dwvApp.getElement(this.borderClassName + ' hover');
    if (box && box.className.indexOf(this.hoverClassName) !== -1) {
        box.className = box.className.replace(' ' + this.hoverClassName, '');
    }
  }

  /**
   * Hide the data load drop box.
   */
  private hideDropbox = () => {
    // remove box
    const box = this.dwvApp.getElement(this.dropboxClassName);
    if (box) {
      box.parentNode.removeChild(box);
    }
  }

  /**
   * Handle a drop event.
   * @param event The event to handle.
   */
  private onDrop = (event: DragEvent) => {
    // prevent default handling
    event.stopPropagation();
    event.preventDefault();
    // load files
    this.dwvApp.loadFiles(event.dataTransfer.files);
    // hide drop box
    this.hideDropbox();
  }

  // drag and drop [end] -------------------------------------------------------

}
